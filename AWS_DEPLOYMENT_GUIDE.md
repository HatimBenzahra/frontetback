# AWS Deployment Guide for Full-Stack Application

This guide will help you deploy your full-stack application (React Frontend + NestJS Backend + Python Audio Server + PostgreSQL) on AWS.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │   Application   │    │   RDS           │
│   (Frontend)    │    │   Load Balancer │    │   PostgreSQL    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   S3 Bucket     │    │   ECS Cluster   │    │   ElastiCache   │
│   (Static)      │    │   (Backend)     │    │   (Redis)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI installed and configured
3. Docker installed locally
4. Domain name (optional but recommended)

## Step 1: Database Setup (RDS PostgreSQL)

### 1.1 Create RDS Instance

```bash
# Create RDS subnet group
aws rds create-db-subnet-group \
    --db-subnet-group-name myapp-subnet-group \
    --db-subnet-group-description "Subnet group for my app" \
    --subnet-ids subnet-12345678 subnet-87654321

# Create RDS instance
aws rds create-db-instance \
    --db-instance-identifier myapp-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username postgres \
    --master-user-password YourSecurePassword123! \
    --allocated-storage 20 \
    --storage-type gp2 \
    --db-subnet-group-name myapp-subnet-group \
    --vpc-security-group-ids sg-12345678 \
    --backup-retention-period 7 \
    --multi-az false \
    --publicly-accessible false \
    --storage-encrypted
```

### 1.2 Update Environment Variables

Create `.env` files for your backend:

```bash
# backend/.env
DATABASE_URL="postgresql://postgres:YourSecurePassword123!@myapp-db.region.rds.amazonaws.com:5432/myapp"
NODE_ENV=production
API_PORT=3000
CLIENT_HOST=your-domain.com
```

## Step 2: Backend Deployment (ECS Fargate)

### 2.1 Create Dockerfile for Backend

```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]
```

### 2.2 Create ECR Repository and Push Image

```bash
# Create ECR repository
aws ecr create-repository --repository-name myapp-backend

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build and tag image
cd backend
docker build -t myapp-backend .
docker tag myapp-backend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp-backend:latest

# Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp-backend:latest
```

### 2.3 Create ECS Task Definition

```json
{
  "family": "myapp-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp-backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "API_PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/myapp-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### 2.4 Create ECS Service

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name myapp-cluster

# Create task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
    --cluster myapp-cluster \
    --service-name myapp-backend-service \
    --task-definition myapp-backend:1 \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-12345678,subnet-87654321],securityGroups=[sg-12345678],assignPublicIp=ENABLED}" \
    --load-balancer "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/myapp-backend/1234567890123456,containerName=backend,containerPort=3000"
```

## Step 3: Python Audio Server Deployment

### 3.1 Create Dockerfile for Python Server

```dockerfile
# backend/python-server/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start the server
CMD ["python", "audio_streaming_server.py"]
```

### 3.2 Deploy Python Server to ECS

```bash
# Create ECR repository for Python server
aws ecr create-repository --repository-name myapp-python-server

# Build and push Python server image
cd backend/python-server
docker build -t myapp-python-server .
docker tag myapp-python-server:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp-python-server:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp-python-server:latest
```

## Step 4: Frontend Deployment (S3 + CloudFront)

### 4.1 Build Frontend

```bash
cd moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
npm run build
```

### 4.2 Create S3 Bucket and Upload

```bash
# Create S3 bucket
aws s3 mb s3://myapp-frontend-bucket

# Upload built files
aws s3 sync dist/ s3://myapp-frontend-bucket --delete

# Configure bucket for static website hosting
aws s3 website s3://myapp-frontend-bucket --index-document index.html --error-document index.html
```

### 4.3 Create CloudFront Distribution

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
    --distribution-config file://cloudfront-config.json
```

CloudFront configuration (`cloudfront-config.json`):
```json
{
  "CallerReference": "myapp-frontend-$(date +%s)",
  "Comment": "MyApp Frontend Distribution",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-myapp-frontend-bucket",
        "DomainName": "myapp-frontend-bucket.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-myapp-frontend-bucket",
    "ViewerProtocolPolicy": "redirect-to-https",
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0
  },
  "Enabled": true
}
```

## Step 5: Load Balancer Setup

### 5.1 Create Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
    --name myapp-alb \
    --subnets subnet-12345678 subnet-87654321 \
    --security-groups sg-12345678

# Create target group for backend
aws elbv2 create-target-group \
    --name myapp-backend-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id vpc-12345678 \
    --target-type ip \
    --health-check-path /health

# Create listener
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/myapp-alb/1234567890123456 \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/myapp-backend-tg/1234567890123456
```

## Step 6: Environment Configuration

### 6.1 Update Frontend Environment

Create `moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/.env.production`:
```bash
VITE_API_URL=https://your-alb-domain.com
VITE_SOCKET_URL=wss://your-alb-domain.com
VITE_PYTHON_SERVER_URL=https://your-python-server-domain.com
```

### 6.2 Update Backend CORS

Update `backend/src/main.ts` to include your production domains:
```typescript
app.enableCors({
  origin: [
    'https://your-cloudfront-domain.com',
    'https://your-domain.com'
  ],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
});
```

## Step 7: SSL/TLS Setup

### 7.1 Request SSL Certificate

```bash
# Request certificate
aws acm request-certificate \
    --domain-name your-domain.com \
    --subject-alternative-names *.your-domain.com \
    --validation-method DNS
```

### 7.2 Configure HTTPS Listeners

```bash
# Create HTTPS listener
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/myapp-alb/1234567890123456 \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012 \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/myapp-backend-tg/1234567890123456
```

## Step 8: Monitoring and Logging

### 8.1 Set up CloudWatch Logs

```bash
# Create log groups
aws logs create-log-group --log-group-name /ecs/myapp-backend
aws logs create-log-group --log-group-name /ecs/myapp-python-server
```

### 8.2 Set up CloudWatch Alarms

```bash
# Create CPU alarm
aws cloudwatch put-metric-alarm \
    --alarm-name myapp-backend-cpu \
    --alarm-description "CPU utilization high" \
    --metric-name CPUUtilization \
    --namespace AWS/ECS \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2
```

## Step 9: CI/CD Pipeline (Optional)

### 9.1 Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Build and push backend
        run: |
          cd backend
          docker build -t myapp-backend .
          docker tag myapp-backend:latest ${{ secrets.ECR_REGISTRY }}/myapp-backend:latest
          docker push ${{ secrets.ECR_REGISTRY }}/myapp-backend:latest
      - name: Update ECS service
        run: |
          aws ecs update-service --cluster myapp-cluster --service myapp-backend-service --force-new-deployment

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
          npm ci
      - name: Build frontend
        run: |
          cd moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b
          npm run build
      - name: Deploy to S3
        run: |
          aws s3 sync moduleProspec-1dc4f634c6c14f0913f8052d2523c56f04d7738b/dist/ s3://myapp-frontend-bucket --delete
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

## Step 10: Security Best Practices

### 10.1 IAM Roles and Policies

Create minimal IAM roles for ECS tasks:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp/*"
    }
  ]
}
```

### 10.2 Security Groups

Configure security groups to allow only necessary traffic:
```bash
# Backend security group
aws ec2 create-security-group \
    --group-name myapp-backend-sg \
    --description "Security group for backend" \
    --vpc-id vpc-12345678

# Allow traffic from ALB
aws ec2 authorize-security-group-ingress \
    --group-id sg-12345678 \
    --protocol tcp \
    --port 3000 \
    --source-group sg-alb-12345678
```

## Estimated Costs (Monthly)

- **RDS PostgreSQL (db.t3.micro)**: ~$15
- **ECS Fargate (2 tasks)**: ~$30
- **Application Load Balancer**: ~$20
- **S3 + CloudFront**: ~$5
- **Total**: ~$70/month

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure RDS security group allows traffic from ECS tasks
2. **CORS Errors**: Verify CORS configuration in backend matches frontend domain
3. **SSL Issues**: Check certificate validation and ALB listener configuration
4. **Memory Issues**: Monitor ECS task memory usage and adjust if needed

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster myapp-cluster --services myapp-backend-service

# View CloudWatch logs
aws logs tail /ecs/myapp-backend --follow

# Check ALB health
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/myapp-backend-tg/1234567890123456
```

## Next Steps

1. Set up monitoring with CloudWatch dashboards
2. Configure auto-scaling policies
3. Set up backup and disaster recovery
4. Implement blue-green deployments
5. Add CDN caching for static assets
6. Set up alerting for critical metrics

This deployment guide provides a production-ready setup for your full-stack application on AWS. Remember to replace placeholder values (ARNs, IDs, domains) with your actual AWS resources. 
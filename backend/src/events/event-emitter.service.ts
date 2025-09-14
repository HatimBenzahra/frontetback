import { Injectable, OnModuleInit } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class EventEmitterService implements OnModuleInit {
  private io: Server;

  onModuleInit() {
    // Cette méthode sera appelée quand le module est initialisé
    // Nous récupérerons l'instance du serveur IO depuis le module principal
  }

  setIoServer(io: Server) {
    this.io = io;
  }

  emitToRoom(room: string, event: string, data: any) {
    if (this.io) {
      this.io.to(room).emit(event, data);
      console.log(`📡 Événement ${event} émis vers la room ${room}`);
    } else {
      console.warn(`⚠️ Serveur IO non disponible pour émettre l'événement ${event}`);
    }
  }

  emitToAll(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
      console.log(`📡 Événement ${event} émis vers tous les clients`);
    } else {
      console.warn(`⚠️ Serveur IO non disponible pour émettre l'événement ${event}`);
    }
  }
}

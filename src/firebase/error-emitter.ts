
import { EventEmitter } from 'events';
import { FirestorePermissionError } from './errors';

// Extend the EventEmitter type definitions for our specific event
interface MyEvents {
  'permission-error': (error: FirestorePermissionError) => void;
}

declare interface MyEventEmitter {
  on<TEv extends keyof MyEvents>(event: TEv, listener: MyEvents[TEv]): this;
  off<TEv extends keyof MyEvents>(event: TEv, listener: MyEvents[TEv]): this;
  once<TEv extends keyof MyEvents>(event: TEv, listener: MyEvents[TEv]): this;
  emit<TEv extends keyof MyEvents>(event: TEv, ...args: Parameters<MyEvents[TEv]>): boolean;
}

class MyEventEmitter extends EventEmitter {}

export const errorEmitter = new MyEventEmitter();

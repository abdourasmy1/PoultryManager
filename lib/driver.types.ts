export interface Driver {
  exec(sql: string): void;
  run(sql: string, params?: any[]): void;
  all<T>(sql: string, params?: any[]): T[];
  persist(): Promise<void>;
  export(): Uint8Array;
  restore(data: Uint8Array): void;
}

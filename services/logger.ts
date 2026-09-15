export type LogLevel = 'info' | 'success' | 'warn' | 'error';
export type LogCategory = 'SCAN' | 'RPC' | 'TOKEN' | 'BURN' | 'PARSER' | 'PRICE' | 'SYSTEM' | 'SWEEPER';

export interface LogEntry {
  id: string;
  timestamp: string;
  timeMs: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
}

type LogListener = (entry: LogEntry) => void;

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs: number = 500;

  addLog(level: LogLevel, category: LogCategory, message: string, details?: any): LogEntry {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: timeStr,
      timeMs: now.getTime(),
      level,
      category,
      message,
      details,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {
        // ignore listener error
      }
    });

    return entry;
  }

  info(category: LogCategory, message: string, details?: any) {
    return this.addLog('info', category, message, details);
  }

  success(category: LogCategory, message: string, details?: any) {
    return this.addLog('success', category, message, details);
  }

  warn(category: LogCategory, message: string, details?: any) {
    return this.addLog('warn', category, message, details);
  }

  error(category: LogCategory, message: string, details?: any) {
    return this.addLog('error', category, message, details);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.info('SYSTEM', 'Log konsol telah dibersihkan.');
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const logger = new LoggerService();


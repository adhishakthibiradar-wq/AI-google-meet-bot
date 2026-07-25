import { BotLog } from '../../src/types.js';

class Logger {
  private logs: BotLog[] = [];
  private maxLogs = 200;

  public log(
    message: string,
    source: BotLog['source'] = 'system',
    level: BotLog['level'] = 'info'
  ): BotLog {
    const newLog: BotLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level,
      message,
      source,
    };

    console.log(`[${newLog.timestamp}] [${source.toUpperCase()}] [${level.toUpperCase()}]: ${message}`);

    this.logs.unshift(newLog);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return newLog;
  }

  public info(message: string, source: BotLog['source'] = 'system') {
    return this.log(message, source, 'info');
  }

  public warn(message: string, source: BotLog['source'] = 'system') {
    return this.log(message, source, 'warn');
  }

  public error(message: string, source: BotLog['source'] = 'system') {
    return this.log(message, source, 'error');
  }

  public success(message: string, source: BotLog['source'] = 'system') {
    return this.log(message, source, 'success');
  }

  public getLogs(): BotLog[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
  }
}

export const logger = new Logger();

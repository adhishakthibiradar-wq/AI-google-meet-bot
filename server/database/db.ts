import fs from 'fs';
import path from 'path';
import { Meeting } from '../../src/types.js';
import { logger } from '../utilities/logger.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'meetings.json');

export class Database {
  private meetings: Map<string, Meeting> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const fileData = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed: Meeting[] = JSON.parse(fileData);
        parsed.forEach((meeting) => {
          this.meetings.set(meeting.id, meeting);
        });
        logger.info(`Loaded ${this.meetings.size} meetings from database file`, 'system');
      } else {
        // Save initial empty database file
        this.saveToFile();
        logger.info('Initialized new meeting database', 'system');
      }
    } catch (err: any) {
      logger.error(`Database init failed: ${err?.message || err}`, 'system');
    }
  }

  private saveToFile() {
    try {
      const data = Array.from(this.meetings.values());
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      logger.error(`Failed to persist database file: ${err?.message || err}`, 'system');
    }
  }

  public getAllMeetings(): Meeting[] {
    return Array.from(this.meetings.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getMeetingById(id: string): Meeting | undefined {
    return this.meetings.get(id);
  }

  public saveMeeting(meeting: Meeting): Meeting {
    this.meetings.set(meeting.id, meeting);
    this.saveToFile();
    return meeting;
  }

  public updateMeeting(id: string, updates: Partial<Meeting>): Meeting | undefined {
    const existing = this.meetings.get(id);
    if (!existing) return undefined;

    const updated: Meeting = {
      ...existing,
      ...updates,
    };

    this.meetings.set(id, updated);
    this.saveToFile();
    return updated;
  }

  public deleteMeeting(id: string): boolean {
    const deleted = this.meetings.delete(id);
    if (deleted) {
      this.saveToFile();
    }
    return deleted;
  }
}

export const db = new Database();

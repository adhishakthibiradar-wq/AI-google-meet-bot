import { Meeting } from "../../src/types.js";
import MeetingModel from "../models/Meeting.js";

export class Database {

  async getAllMeetings(): Promise<Meeting[]> {
    return (await MeetingModel.find().sort({ createdAt: -1 }).lean()) as Meeting[];
  }

  async getMeetingById(id: string): Promise<Meeting | null> {
    return (await MeetingModel.findOne({ id }).lean()) as Meeting | null;
  }

  async saveMeeting(meeting: Meeting): Promise<Meeting> {
  await MeetingModel.create(meeting as any);
  return meeting;
}

  async updateMeeting(
    id: string,
    updates: Partial<Meeting>
  ): Promise<Meeting | null> {
    return (await MeetingModel.findOneAndUpdate(
      { id },
      updates,
      { new: true }
    ).lean()) as Meeting | null;
  }

  async deleteMeeting(id: string): Promise<boolean> {
    const result = await MeetingModel.deleteOne({ id });
    return result.deletedCount > 0;
  }
}

export const db = new Database();
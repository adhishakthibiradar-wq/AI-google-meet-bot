import mongoose from "mongoose";

const MeetingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },

    title: { type: String, required: true },
    meetUrl: { type: String, default: "" },
    status: { type: String, required: true },

    startTime: String,
    endTime: String,
    createdAt: String,

    durationSeconds: { type: Number, default: 0 },
    recordingPath: String,
    audioSizeMb: Number,

    transcript: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    summary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    botConfig: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    logs: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    errorMessage: String,
  },
  {
    timestamps: true,
    collection: "meetings",
  }
);

export default mongoose.model("Meeting", MeetingSchema);
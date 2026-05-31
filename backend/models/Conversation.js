import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    id: String,
    type: { type: String, enum: ["signed", "typed"], default: "signed" },
    rawWords: [String],
    sentence: String,
    timestamp: Number,
    confidence: Number,
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messages: [messageSchema],
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { timestamps: true }
);

sessionSchema.index({ userId: 1, clientId: 1 }, { unique: true });

export const ConversationSession = mongoose.model("ConversationSession", sessionSchema);

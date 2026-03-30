import { Schema, model, Document } from 'mongoose';

export interface IAbout extends Document {
  heroTitle: string;
  heroSubtitle: string;
  storyTitle: string;
  storyBody: string;
  mission: string;
  values: string[];
}

const aboutSchema = new Schema<IAbout>(
  {
    heroTitle: { type: String, default: 'About DopeCuts' },
    heroSubtitle: { type: String, default: '' },
    storyTitle: { type: String, default: 'Our Story' },
    storyBody: { type: String, default: '' },
    mission: { type: String, default: '' },
    values: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const About = model<IAbout>('About', aboutSchema);

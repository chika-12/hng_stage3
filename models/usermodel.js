const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
      required: true,
    },
    gender_probability: {
      type: Number,
      required: true,
    },
    age: {
      type: Number,
      required: true,
    },
    age_group: {
      type: String,
      enum: ['child', 'teenager', 'adult', 'senior'],
      required: true,
    },
    country_id: {
      type: String,
      required: true,
    },
    country_name: {
      type: String,
      required: true,
    },
    country_probability: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
    toJSON: {
      transform: function (doc, ret) {
        delete ret._id;
        return ret;
      },
    },
  }
);
profileSchema.index({ gender: 1 });
profileSchema.index({ country_id: 1 });
profileSchema.index({ age_group: 1 });
//profileSchema.index({ name: 1 });
profileSchema.index({ gender: 1, country_id: 1, age_group: 1 });

const Profile = mongoose.model('Profile', profileSchema);
module.exports = Profile;

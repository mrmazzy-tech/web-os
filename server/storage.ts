import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

// --- 1. Database Connection ---
/**
 * Connects to the MongoDB database using the URI from environment variables.
 * This function should be called once when the server starts.
 */
export const connectToDatabase = async () => {
  // CRITICAL SECURITY FIX: Never hardcode the URI.
  // Use Replit Secrets to set this value.
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error(
      "❌ FATAL ERROR: MONGO_URI is not defined in environment variables.",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Successfully connected to MongoDB");
  } catch (err) {
    console.error("❌ Error connecting to MongoDB:", err);
    process.exit(1);
  }
};

// --- 2. School (Tenant) Model ---
const SchoolSchema = new Schema(
  {
    schoolName: { type: String, required: true },
    institutionType: { type: String, required: true },
    logoUrl: { type: String }, // Existed

    // --- NEW FIELDS FOR SAAS ONBOARDING ---
    address: { type: String },
    phone: { type: String },

    // This is the user who "owns" the school/tenant.
    // We will update the /register route to set this.
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      // This is now required to link a tenant to its owner
      required: true,
      index: true,
    },

    // SaaS Plan Management Fields (Existed)
    subscriptionTier: { type: String, default: "free" },
    paymentStatus: { type: String, default: "pending" }, // e.g., free, active, past_due

    // Wizard Completion Flag
    isOnboardingComplete: { type: Boolean, default: false },
    // --- END NEW FIELDS ---
  },
  { timestamps: true },
);
export const School = mongoose.model("School", SchoolSchema);

// --- 3. User Model ---
const UserSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: [
        "Admin",
        "Teacher",
        "Accountant",
        "Parent",
        "Student",
        "SuperAdmin",
      ], // Added SuperAdmin
    },
    // AUTH UPDATE: Added field to store the refresh token for session management
    refreshToken: { type: String },
    studentProfileId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      sparse: true,
    },
    teacherProfileId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      sparse: true,
    },
  },
  { timestamps: true },
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// --- NEW: Method to compare passwords ---
// This is used in the login route
UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model("User", UserSchema);

// --- 4. Class Model ---
const ClassSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    section: { type: String },
  },
  { timestamps: true },
);
ClassSchema.index({ schoolId: 1, name: 1, section: 1 }, { unique: true });
export const Class = mongoose.model("Class", ClassSchema);

// --- 5. Student Model ---
const StudentSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    fullName: { type: String, required: true },
    rollNumber: { type: String, sparse: true },
    parentContact: { type: String },
    parentUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },
  },
  { timestamps: true },
);
StudentSchema.index(
  { classId: 1, rollNumber: 1 },
  { unique: true, sparse: true },
);
export const Student = mongoose.model("Student", StudentSchema);

// --- 6. Teacher Model ---
const TeacherSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
      unique: true,
    },
    fullName: { type: String, required: true },
    subject: { type: String, required: true },
    contactNumber: { type: String },
    classAssignments: [{ type: Schema.Types.ObjectId, ref: "Class" }],
  },
  { timestamps: true },
);
export const Teacher = mongoose.model("Teacher", TeacherSchema);

// --- 7. Attendance Model ---
const AttendanceSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    date: { type: Date, required: true }, // Should be stored as UTC midnight
    status: {
      type: String,
      required: true,
      enum: ["Present", "Absent", "Late", "Leave"],
    },
    markedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
AttendanceSchema.index(
  { schoolId: 1, studentId: 1, date: 1 },
  { unique: true },
);
export const Attendance = mongoose.model("Attendance", AttendanceSchema);

// --- 8. Fee Head Model ---
const FeeHeadSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    isOneTime: { type: Boolean, default: false },
  },
  { timestamps: true },
);
FeeHeadSchema.index({ schoolId: 1, name: 1 }, { unique: true }); // Added unique index
export const FeeHead = mongoose.model("FeeHead", FeeHeadSchema);

// --- 9. Fee Structure Model ---
const FeeStructureSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    feeHeadId: {
      type: Schema.Types.ObjectId,
      ref: "FeeHead",
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    monthYear: { type: String, required: true, index: true }, // e.g., "2025-10"
  },
  { timestamps: true },
);
FeeStructureSchema.index(
  { schoolId: 1, classId: 1, feeHeadId: 1, monthYear: 1 },
  { unique: true },
);
export const FeeStructure = mongoose.model("FeeStructure", FeeStructureSchema);

// --- 10. Fee Payment Model ---
const FeePaymentSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    classId: {
      // Denormalized for easier reporting
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    monthYear: { type: String, required: true, index: true }, // e.g., "2025-10"
    paymentDate: { type: Date, default: Date.now },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    /**
     * This 'items' array records the specific heads this payment was for.
     * This allows for partial payments.
     */
    items: [
      {
        feeHeadId: {
          type: Schema.Types.ObjectId,
          ref: "FeeHead",
          required: true,
        },
        amountPaid: { type: Number, required: true },
      },
    ],
    totalAmountPaid: { type: Number, required: true, min: 1 },
    remarks: { type: String },
  },
  { timestamps: true },
);
export const FeePayment = mongoose.model("FeePayment", FeePaymentSchema);

// --- 11. Examination Model ---
const ExamSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true }, // e.g., "Mid-Terms", "Final Exams"
    academicYear: { type: String, required: true }, // e.g., "2025-2026"
  },
  { timestamps: true },
);
ExamSchema.index({ schoolId: 1, name: 1, academicYear: 1 }, { unique: true });
export const Exam = mongoose.model("Exam", ExamSchema);

// --- 12. Grade/Marks Model ---
const GradeSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    examId: {
      type: Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    subject: { type: String, required: true, index: true }, // e.g., "Mathematics", "English"
    totalMarks: { type: Number, required: true, default: 100 },
    obtainedMarks: { type: Number, required: true, min: 0 },
    remarks: { type: String },
  },
  { timestamps: true },
);
// This index ensures one student can only have one grade for a specific subject in a specific exam
GradeSchema.index({ studentId: 1, examId: 1, subject: 1 }, { unique: true });
export const Grade = mongoose.model("Grade", GradeSchema);

import {
  Router,
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser"; // Required for refresh tokens

// Import all models
import {
  School,
  User,
  Class,
  Student,
  Teacher,
  Attendance,
  FeeHead,
  FeeStructure,
  FeePayment,
  Exam,
  Grade,
} from "./storage";

// --- CRITICAL SECURITY FIX: Use Environment Variables ---
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!JWT_SECRET || !REFRESH_TOKEN_SECRET) {
  console.error(
    "❌ FATAL ERROR: JWT_SECRET or REFRESH_TOKEN_SECRET is not defined.",
  );
  process.exit(1);
}

// --- JWT Payload Interface ---
interface UserPayload {
  userId: string;
  schoolId: string;
  role: string;
}

// --- Helper Functions for Token Generation ---
const generateAccessToken = (user: UserPayload) => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "15m" });
};

const generateRefreshToken = (user: UserPayload) => {
  return jwt.sign(user, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
};

// --- Authentication Middleware (authenticateToken) ---
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(401); // Unauthorized

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.error("JWT Verification Error:", err.message);
      return res.sendStatus(403); // Forbidden (token invalid or expired)
    }
    (req as any).user = user as UserPayload;
    next();
  });
};

export const registerRoutes = async (app: Application) => {
  const router = Router();
  router.use(cookieParser()); // Use cookie-parser middleware

  // --- 1. AUTHENTICATION ENDPOINTS ---

  router.post("/auth/register", async (req, res) => {
    // Start a session for a transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { fullName, email, password, schoolName, institutionType } =
        req.body;
      if (!fullName || !email || !password || !schoolName || !institutionType) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const existingUser = await User.findOne({ email }).session(session);
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "This email is already in use." });
      }

      // Create Admin User first (we need the _id)
      const newAdminUser = new User({
        fullName,
        email,
        password,
        role: "Admin",
        // schoolId will be set next
      });

      // Create the School, linking the owner
      const newSchool = new School({
        schoolName,
        institutionType,
        ownerUserId: newAdminUser._id, // <-- CRITICAL UPDATE #1
      });

      // Now set the schoolId on the user
      newAdminUser.schoolId = newSchool._id;

      // Save both documents within the transaction
      await newSchool.save({ session });
      await newAdminUser.save({ session });

      // --- Auto-generate defaults for the new school ---
      if (
        institutionType === "School" ||
        institutionType === "School & College"
      ) {
        const defaultGrades = [
          "Playgroup",
          "Nursery",
          "KG",
          "Grade 1",
          "Grade 2",
          "Grade 3",
          "Grade 4",
          "Grade 5",
          "Grade 6",
          "Grade 7",
          "Grade 8",
          "Grade 9",
          "Grade 10",
          "Grade 11",
          "Grade 12",
        ];
        const classOperations = defaultGrades.map((name) => ({
          insertOne: {
            document: {
              schoolId: newSchool._id,
              name: name,
              section: "A",
            },
          },
        }));
        await Class.bulkWrite(classOperations, { session });
      }
      await new FeeHead({
        schoolId: newSchool._id,
        name: "Tuition Fee",
      }).save({ session });

      // --- Log the user in ---
      const payload: UserPayload = {
        userId: newAdminUser._id,
        schoolId: newSchool._id,
        role: newAdminUser.role,
      };
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Save refresh token to user in DB
      newAdminUser.refreshToken = refreshToken;
      await newAdminUser.save({ session });

      // If everything is successful, commit the transaction
      await session.commitTransaction();

      // Send refresh token as a secure, httpOnly cookie
      res.cookie("jwt", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development", // Use 'secure' in production
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Send access token as JSON
      res.status(201).json({ accessToken });
    } catch (error: any) {
      // If anything fails, abort the transaction
      await session.abortTransaction();
      console.error("Registration Error:", error);
      if (error.code === 11000)
        return res.status(400).json({ message: "Email already exists." });
      res.status(500).json({
        message: "Server error during registration.",
      });
    } finally {
      // End the session
      session.endSession();
    }
  });

  router.post("/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid credentials" });
      }
      // Use the comparePassword method from storage.ts
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const payload: UserPayload = {
        userId: user._id,
        schoolId: user.schoolId,
        role: user.role,
      };
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Save refresh token to user in DB
      user.refreshToken = refreshToken;
      await user.save();

      // Send refresh token as a secure, httpOnly cookie
      res.cookie("jwt", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Send access token as JSON
      res.status(200).json({ accessToken });
    } catch (error) {
      console.error("Login Error:", error);
      res.status(500).json({ message: "Server error during login" });
    }
  });

  router.get("/auth/refresh", async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(401);
    const refreshToken = cookies.jwt;
    try {
      const user = await User.findOne({ refreshToken });
      if (!user) return res.sendStatus(403);
      jwt.verify(
        refreshToken,
        REFRESH_TOKEN_SECRET,
        (err: any, decoded: any) => {
          if (err || user._id.toString() !== decoded.userId) {
            return res.sendStatus(403);
          }
          const payload: UserPayload = {
            userId: user._id,
            schoolId: user.schoolId,
            role: user.role,
          };
          const accessToken = generateAccessToken(payload);
          res.json({ accessToken });
        },
      );
    } catch (error) {
      console.error("Refresh Token Error:", error);
      res.sendStatus(500);
    }
  });

  router.post("/auth/logout", async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(204);
    const refreshToken = cookies.jwt;
    try {
      await User.findOneAndUpdate(
        { refreshToken },
        { $unset: { refreshToken: 1 } },
      );
    } catch (error) {
      console.error("Logout DB Error:", error);
    }
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
    });
    res.sendStatus(204);
  });

  // --- 2. USER ENDPOINTS ---
  router.get(
    "/users/me",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).user.userId;
        const user = await User.findById(userId)
          .select("-password -refreshToken")
          // --- THIS IS THE FIX ---
          .populate(
            "schoolId",
            "schoolName institutionType subscriptionTier isOnboardingComplete logoUrl address phone paymentStatus", // <-- ADDED paymentStatus
          );
        // --- END FIX ---
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(user);
      } catch (error) {
        console.error("Get Me Error:", error);
        res.status(500).json({ message: "Server error fetching user" });
      }
    },
  );

  // --- 3. CLASS MANAGEMENT API ENDPOINTS ---
  router.get(
    "/classes",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const classes = await Class.find({ schoolId: schoolId }).sort({
          name: 1,
        });
        res.status(200).json(classes);
      } catch (error) {
        res.status(500).json({ message: "Server error fetching classes" });
      }
    },
  );

  router.post(
    "/classes",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const { name, section } = req.body;
        if (!name)
          return res.status(400).json({ message: "Class name is required." });

        const newClass = new Class({
          schoolId: schoolId,
          name,
          section,
        });
        await newClass.save();
        res.status(201).json(newClass);
      } catch (error: any) {
        if (error.code === 11000)
          return res
            .status(400)
            .json({ message: "This class name/section already exists." });
        res.status(500).json({ message: "Server error adding class" });
      }
    },
  );

  router.put(
    "/classes/:id",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const classId = req.params.id;
        const { name, section } = req.body;

        if (!name || typeof name !== "string" || name.trim() === "") {
          return res
            .status(400)
            .json({ message: "Class name cannot be empty." });
        }
        const trimmedName = name.trim();
        const trimmedSection = section?.trim() || undefined;

        const existingClass = await Class.findOne({
          schoolId: schoolId,
          name: trimmedName,
          section: trimmedSection,
          _id: { $ne: classId },
        });

        if (existingClass) {
          return res.status(400).json({
            message: `Another class with name "${trimmedName}" ${trimmedSection ? `and section "${trimmedSection}"` : ""} already exists.`,
          });
        }

        const updatedClass = await Class.findOneAndUpdate(
          { _id: classId, schoolId: schoolId },
          { $set: { name: trimmedName, section: trimmedSection } },
          { new: true, runValidators: true },
        );

        if (!updatedClass) {
          return res.status(404).json({
            message:
              "Class not found or you do not have permission to edit it.",
          });
        }

        console.log("Sending updated class:", JSON.stringify(updatedClass));
        res.status(200).json(updatedClass);
      } catch (error: any) {
        console.error("Update Class Error:", error);
        if (error.name === "ValidationError") {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error updating class." });
      }
    },
  );

  router.delete(
    "/classes/:id",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const { id } = req.params;

        const studentCount = await Student.countDocuments({
          schoolId: schoolId,
          classId: id,
        });
        if (studentCount > 0) {
          return res.status(400).json({
            message: `Cannot delete: ${studentCount} student(s) are assigned to this class.`,
          });
        }
        const result = await Class.deleteOne({
          _id: id,
          schoolId: schoolId,
        });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Class not found." });
        }
        res.status(200).json({ message: "Class deleted successfully" });
      } catch (error: any) {
        res.status(500).json({ message: "Server error deleting class" });
      }
    },
  );

  // --- 4. STUDENT MANAGEMENT API ENDPOINTS ---
  router.get(
    "/students",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const { classId } = req.query;
        let filter: any = { schoolId: schoolId };
        if (classId) {
          filter.classId = classId as string;
        }
        const students = await Student.find(filter)
          .populate("classId", "name section")
          .sort({ fullName: 1 });
        res.status(200).json(students);
      } catch (error) {
        res.status(500).json({ message: "Server error fetching students" });
      }
    },
  );

  router.post(
    "/students",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const { fullName, classId, rollNumber, parentContact } = req.body;
        if (!fullName || !classId) {
          return res
            .status(400)
            .json({ message: "Full Name and Class ID are required." });
        }
        if (rollNumber) {
          const existingStudent = await Student.findOne({
            schoolId,
            classId,
            rollNumber,
          });
          if (existingStudent) {
            return res.status(400).json({
              message: `Roll Number ${rollNumber} already exists in this class.`,
            });
          }
        }
        const newStudent = new Student({
          schoolId,
          fullName,
          classId,
          rollNumber,
          parentContact,
        });
        await newStudent.save();
        const populatedStudent = await Student.findById(
          newStudent._id,
        ).populate("classId", "name section");
        res.status(201).json(populatedStudent);
      } catch (error) {
        res.status(500).json({ message: "Server error adding student" });
      }
    },
  );

  router.put(
    "/students/:id",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const studentId = req.params.id;
        const updates = req.body;

        if (!updates.fullName || !updates.classId) {
          return res
            .status(400)
            .json({ message: "Full Name and Class ID cannot be empty." });
        }
        if (updates.rollNumber) {
          const existingStudent = await Student.findOne({
            schoolId: schoolId,
            classId: updates.classId,
            rollNumber: updates.rollNumber,
            _id: { $ne: studentId },
          });
          if (existingStudent) {
            return res.status(400).json({
              message: `Roll Number ${updates.rollNumber} already exists.`,
            });
          }
        }
        const student = await Student.findOneAndUpdate(
          { _id: studentId, schoolId: schoolId },
          updates,
          { new: true, runValidators: true },
        );
        if (!student) {
          return res.status(404).json({ message: "Student not found." });
        }
        res.status(200).json(student);
      } catch (error: any) {
        res.status(500).json({ message: "Server error updating student" });
      }
    },
  );

  router.delete(
    "/students/:id",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const studentId = req.params.id;
        const result = await Student.deleteOne({
          _id: studentId,
          schoolId: schoolId,
        });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Student not found." });
        }
        res.status(200).json({ message: "Student deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Server error deleting student" });
      }
    },
  );

  // --- 5. TEACHER MANAGEMENT API ENDPOINTS ---
  router.post(
    "/teachers",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const { fullName, subject, contactNumber, classAssignments } = req.body;

        if (
          !fullName ||
          typeof fullName !== "string" ||
          fullName.trim() === ""
        ) {
          return res.status(400).json({ message: "Full Name is required." });
        }
        if (!subject || typeof subject !== "string" || subject.trim() === "") {
          return res.status(400).json({ message: "Subject is required." });
        }
        if (
          classAssignments &&
          (!Array.isArray(classAssignments) ||
            classAssignments.some((id) => !mongoose.Types.ObjectId.isValid(id)))
        ) {
          return res
            .status(400)
            .json({ message: "Invalid class assignments data." });
        }

        const newTeacher = new Teacher({
          schoolId,
          fullName: fullName.trim(),
          subject: subject.trim(),
          contactNumber: contactNumber?.trim() || undefined,
          classAssignments: classAssignments || [],
        });

        await newTeacher.save();

        const populatedTeacher = await Teacher.findById(
          newTeacher._id,
        ).populate("classAssignments", "name section");

        res.status(201).json(populatedTeacher);
      } catch (error: any) {
        console.error("Add Teacher Error:", error);
        if (error.name === "ValidationError") {
          const messages = Object.values(error.errors).map(
            (el: any) => el.message,
          );
          const errorMessage = messages.join(" ");
          return res
            .status(400)
            .json({ message: errorMessage || error.message });
        }
        if (error.code === 11000) {
          return res.status(400).json({
            message: "A teacher with similar details might already exist.",
          });
        }
        res.status(500).json({ message: "Server error adding teacher." });
      }
    },
  );

  router.get(
    "/teachers",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const teachers = await Teacher.find({ schoolId: schoolId })
          .populate("classAssignments", "name section")
          .sort({ fullName: 1 });
        res.status(200).json(teachers);
      } catch (error) {
        res.status(500).json({ message: "Server error fetching teachers" });
      }
    },
  );

  router.put(
    "/teachers/:id",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const teacherId = req.params.id;
        const { fullName, subject, contactNumber, classAssignments } = req.body;

        if (
          !fullName ||
          typeof fullName !== "string" ||
          fullName.trim() === ""
        ) {
          return res.status(400).json({ message: "Full Name is required." });
        }
        if (!subject || typeof subject !== "string" || subject.trim() === "") {
          return res.status(400).json({ message: "Subject is required." });
        }
        if (
          classAssignments &&
          (!Array.isArray(classAssignments) ||
            classAssignments.some((id) => !mongoose.Types.ObjectId.isValid(id)))
        ) {
          return res
            .status(400)
            .json({ message: "Invalid class assignments data." });
        }

        const updatedTeacher = await Teacher.findOneAndUpdate(
          { _id: teacherId, schoolId: schoolId },
          {
            $set: {
              fullName: fullName.trim(),
              subject: subject.trim(),
              contactNumber: contactNumber?.trim() || undefined,
              classAssignments: classAssignments || [],
            },
          },
          { new: true, runValidators: true },
        );

        if (!updatedTeacher) {
          return res
            .status(404)
            .json({ message: "Teacher not found or permission denied." });
        }

        const populatedTeacher = await Teacher.findById(
          updatedTeacher._id,
        ).populate("classAssignments", "name section");

        res.status(200).json(populatedTeacher);
      } catch (error: any) {
        console.error("Update Teacher Error:", error);
        if (error.name === "ValidationError") {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error updating teacher." });
      }
    },
  );

  router.delete(
    "/teachers/:id",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const teacherId = req.params.id;

        const result = await Teacher.deleteOne({
          _id: teacherId,
          schoolId: schoolId,
        });

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({ message: "Teacher not found or permission denied." });
        }

        res.status(200).json({ message: "Teacher deleted successfully" });
      } catch (error: any) {
        console.error("Delete Teacher Error:", error);
        res.status(500).json({ message: "Server error deleting teacher." });
      }
    },
  );

  // --- 6. ATTENDANCE MANAGEMENT API ENDPOINTS ---
  router.post(
    "/attendance",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId, userId } = (req as any).user;
        const attendanceDataArray = req.body;
        if (
          !Array.isArray(attendanceDataArray) ||
          attendanceDataArray.length === 0
        ) {
          return res
            .status(400)
            .json({ message: "Attendance data must be a non-empty array." });
        }

        const operations = attendanceDataArray.map((record: any) => {
          if (!record.studentId || !record.date || !record.status) {
            throw new Error(
              "Each record must include studentId, date, and status.",
            );
          }
          const attendanceDate = new Date(record.date);
          attendanceDate.setUTCHours(0, 0, 0, 0);

          return {
            updateOne: {
              filter: {
                schoolId: schoolId,
                studentId: record.studentId,
                date: attendanceDate,
              },
              update: {
                $set: {
                  status: record.status,
                  schoolId: schoolId,
                  studentId: record.studentId,
                  markedBy: userId,
                },
              },
              upsert: true,
            },
          };
        });
        const result = await Attendance.bulkWrite(operations);
        res.status(200).json({
          message: "Attendance recorded successfully.",
          result,
        });
      } catch (error: any) {
        res.status(500).json({ message: "Server error recording attendance." });
      }
    },
  );

  router.get(
    "/attendance",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const { date, classId } = req.query;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date as string) || !classId) {
          return res.status(400).json({
            message: "Valid date (YYYY-MM-DD) and classId are required.",
          });
        }

        const targetDate = new Date(date as string);
        targetDate.setUTCHours(0, 0, 0, 0);

        const studentsInClass = await Student.find({
          schoolId: schoolId,
          classId: classId as string,
        }).select("_id");
        const studentIds = studentsInClass.map((s) => s._id);

        const attendanceRecords = await Attendance.find({
          schoolId: schoolId,
          date: targetDate,
          studentId: { $in: studentIds },
        })
          .populate("studentId", "fullName rollNumber")
          .populate("markedBy", "fullName");
        res.status(200).json(attendanceRecords);
      } catch (error) {
        res.status(500).json({ message: "Server error fetching attendance." });
      }
    },
  );

  // --- 7. FEE MANAGEMENT API ENDPOINTS ---
  router.get("/fees/heads", authenticateToken, async (req, res) => {
    try {
      const { schoolId } = (req as any).user;
      const heads = await FeeHead.find({ schoolId });
      res.status(200).json(heads);
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });

  router.post("/fees/heads", authenticateToken, async (req, res) => {
    try {
      const { schoolId } = (req as any).user;
      const { name, isOneTime } = req.body;
      if (!name)
        return res.status(400).json({ message: "Fee Head name is required." });
      const newHead = new FeeHead({ schoolId, name, isOneTime });
      await newHead.save();
      res.status(201).json(newHead);
    } catch (e: any) {
      if (e.code === 11000) {
        return res
          .status(400)
          .json({ message: "A fee head with this name already exists." });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  router.post(
    "/fees/structures",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const { classId, feeHeadId, amount, monthYear } = req.body;

        // Allow amount to be 0
        if (!classId || !feeHeadId || amount == null || !monthYear) {
          return res.status(400).json({
            message: "Class, Fee Head, Amount, and MonthYear are required.",
          });
        }
        if (typeof amount !== "number" || amount < 0) {
          return res
            .status(400)
            .json({ message: "Amount must be a non-negative number." });
        }

        const structure = await FeeStructure.findOneAndUpdate(
          {
            schoolId: schoolId,
            classId: classId,
            feeHeadId: feeHeadId,
            monthYear: monthYear,
          },
          {
            $set: {
              amount: amount,
              schoolId: schoolId,
              classId: classId,
              feeHeadId: feeHeadId,
              monthYear: monthYear,
            },
          },
          { new: true, upsert: true, runValidators: true },
        );
        res.status(200).json(structure);
      } catch (error: any) {
        if (error.code === 11000) {
          return res.status(400).json({
            message:
              "This fee head already has an amount set for this class/month.",
          });
        }
        res
          .status(500)
          .json({ message: "Server error setting fee structure." });
      }
    },
  );

  router.get(
    "/fees/structures",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const { monthYear, classId } = req.query;
        if (!monthYear || !classId)
          return res
            .status(400)
            .json({ message: "monthYear and classId are required." });
        const structures = await FeeStructure.find({
          schoolId,
          monthYear,
          classId,
        }).populate("feeHeadId", "name isOneTime");
        res.status(200).json(structures);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Server error fetching fee structures." });
      }
    },
  );

  // --- 8. PAYMENT & REPORTING ENDPOINTS ---
  router.get(
    "/fees/payments",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const { studentId, monthYear } = req.query;
        if (!studentId || !monthYear) {
          return res
            .status(400)
            .json({ message: "studentId and monthYear are required." });
        }
        const payments = await FeePayment.find({
          schoolId,
          studentId,
          monthYear,
        })
          .populate("receivedBy", "fullName")
          .populate("items.feeHeadId", "name");
        res.status(200).json(payments);
      } catch (error) {
        res.status(500).json({ message: "Server error fetching payments." });
      }
    },
  );

  router.post(
    "/fees/payments",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId, userId } = (req as any).user;
        const {
          studentId,
          classId,
          monthYear,
          totalAmountPaid,
          items,
          remarks,
          paymentDate,
        } = req.body;

        if (
          !studentId ||
          !classId ||
          !monthYear ||
          !totalAmountPaid ||
          !items ||
          !Array.isArray(items) ||
          items.length === 0
        ) {
          return res
            .status(400)
            .json({ message: "Missing required payment fields." });
        }

        const newPayment = new FeePayment({
          schoolId,
          studentId,
          classId,
          monthYear,
          totalAmountPaid,
          items,
          remarks,
          paymentDate: paymentDate || new Date(),
          receivedBy: userId,
        });

        await newPayment.save();
        res.status(201).json(newPayment);
      } catch (error: any) {
        console.error("Record Payment Error:", error);
        res.status(500).json({ message: "Server error recording payment." });
      }
    },
  );

  router.get(
    "/reports/student-ledger",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user;
        const { studentId, monthYear } = req.query;

        if (!studentId || !monthYear) {
          return res
            .status(400)
            .json({ message: "studentId and monthYear are required." });
        }

        const student = await Student.findOne({ _id: studentId, schoolId });
        if (!student) {
          return res.status(404).json({ message: "Student not found." });
        }

        // 1. Get Dues
        const dues = await FeeStructure.find({
          schoolId,
          classId: student.classId,
          monthYear,
        }).populate("feeHeadId", "name");

        // 2. Get Payments
        const payments = await FeePayment.find({
          schoolId,
          studentId,
          monthYear,
        })
          .populate("receivedBy", "fullName")
          .populate("items.feeHeadId", "name")
          .sort({ paymentDate: -1 });

        // 3. Calculate Summary
        let totalDue = 0;
        const dueMap = new Map<string, { name: string; amount: number }>();
        for (const due of dues) {
          if (due.feeHeadId && (due.feeHeadId as any)._id) {
            const head = due.feeHeadId as any;
            totalDue += due.amount;
            dueMap.set(head._id.toString(), {
              name: head.name,
              amount: due.amount,
            });
          }
        }

        let totalPaid = 0;
        const paidMap = new Map<string, number>();
        for (const payment of payments) {
          totalPaid += payment.totalAmountPaid;
          for (const item of payment.items) {
            const headId =
              typeof item.feeHeadId === "object" && item.feeHeadId !== null
                ? (item.feeHeadId as any)._id.toString()
                : item.feeHeadId.toString();
            paidMap.set(headId, (paidMap.get(headId) || 0) + item.amountPaid);
          }
        }

        const balanceDetails = Array.from(dueMap.entries()).map(
          ([feeHeadId, dueInfo]) => {
            const paid = paidMap.get(feeHeadId) || 0;
            return {
              feeHeadId,
              name: dueInfo.name,
              due: dueInfo.amount,
              paid: paid,
              balance: dueInfo.amount - paid,
            };
          },
        );

        res.status(200).json({
          dues: balanceDetails,
          payments: payments,
          summary: {
            totalDue,
            totalPaid,
            balance: totalDue - totalPaid,
          },
        });
      } catch (error) {
        console.error("Get Ledger Error:", error);
        res.status(500).json({ message: "Server error fetching ledger." });
      }
    },
  );

  router.get(
    "/reports/fee-summary",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const { monthYear, classId } = req.query;

        if (!monthYear || typeof monthYear !== "string") {
          return res
            .status(400)
            .json({ message: "Valid monthYear (YYYY-MM) is required." });
        }
        if (classId && !mongoose.Types.ObjectId.isValid(classId as string)) {
          return res.status(400).json({ message: "Invalid classId format." });
        }

        const aggregationPipeline: any[] = [];

        // 1. Match Students
        const studentMatchStage: any = {
          schoolId: new mongoose.Types.ObjectId(schoolId),
        };
        if (classId) {
          studentMatchStage.classId = new mongoose.Types.ObjectId(
            classId as string,
          );
        }
        aggregationPipeline.push({ $match: studentMatchStage });

        // 2. Populate Class Info
        aggregationPipeline.push({
          $lookup: {
            from: "classes",
            localField: "classId",
            foreignField: "_id",
            as: "classInfo",
          },
        });
        // Use preserveNullAndEmptyArrays to keep students even if their class was deleted
        aggregationPipeline.push({
          $unwind: { path: "$classInfo", preserveNullAndEmptyArrays: true },
        });

        // 3. Lookup Fee Structures (Dues)
        aggregationPipeline.push({
          $lookup: {
            from: "feestructures",
            let: {
              student_class_id: "$classId",
              student_school_id: "$schoolId",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$classId", "$$student_class_id"] },
                      { $eq: ["$schoolId", "$$student_school_id"] },
                      { $eq: ["$monthYear", monthYear] },
                    ],
                  },
                },
              },
              { $group: { _id: null, totalDue: { $sum: "$amount" } } },
            ],
            as: "duesInfo",
          },
        });
        aggregationPipeline.push({
          $addFields: {
            totalDue: { $ifNull: [{ $first: "$duesInfo.totalDue" }, 0] },
          },
        });

        // 4. Lookup Fee Payments
        aggregationPipeline.push({
          $lookup: {
            from: "feepayments",
            let: { student_id: "$_id", student_school_id: "$schoolId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$studentId", "$$student_id"] },
                      { $eq: ["$schoolId", "$$student_school_id"] },
                      { $eq: ["$monthYear", monthYear] },
                    ],
                  },
                },
              },
              {
                $group: { _id: null, totalPaid: { $sum: "$totalAmountPaid" } },
              },
            ],
            as: "paymentsInfo",
          },
        });
        aggregationPipeline.push({
          $addFields: {
            totalPaid: { $ifNull: [{ $first: "$paymentsInfo.totalPaid" }, 0] },
          },
        });

        // 5. Calculate Balance
        aggregationPipeline.push({
          $addFields: {
            balance: { $subtract: ["$totalDue", "$totalPaid"] },
          },
        });

        // 6. Project Final Shape
        aggregationPipeline.push({
          $project: {
            _id: 0,
            studentId: "$_id",
            fullName: "$fullName",
            rollNumber: "$rollNumber",
            className: { $ifNull: ["$classInfo.name", "N/A"] }, // Handle missing class
            classSection: "$classInfo.section",
            amountDue: "$totalDue",
            amountPaid: "$totalPaid",
            balance: "$balance",
          },
        });

        // 7. Sort
        aggregationPipeline.push({ $sort: { className: 1, fullName: 1 } });

        const summaryResult = await Student.aggregate(aggregationPipeline);

        res.status(200).json(summaryResult);
      } catch (error: any) {
        console.error("Fee Summary Report Error:", error);
        res
          .status(500)
          .json({ message: "Server error generating fee summary." });
      }
    },
  );

  /**
   * @route GET /api/reports/summary
   * @desc Generates a high-level summary report for a given date range and optional class.
   */
  router.get(
    "/reports/summary",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const { startDate, endDate, classId } = req.query as {
          startDate: string;
          endDate: string;
          classId?: string;
        };

        if (!startDate || !endDate) {
          return res
            .status(400)
            .json({ message: "startDate and endDate are required." });
        }

        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);

        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        // --- 1. Student Count ---
        const studentMatch: any = { schoolId: schoolObjectId };
        if (classId && mongoose.Types.ObjectId.isValid(classId)) {
          studentMatch.classId = new mongoose.Types.ObjectId(classId);
        }
        const studentCount = await Student.countDocuments(studentMatch);

        // --- 2. Attendance Summary ---
        const attendanceMatch: any = {
          schoolId: schoolObjectId,
          date: { $gte: start, $lte: end },
        };

        if (classId && mongoose.Types.ObjectId.isValid(classId)) {
          const studentsInClass = await Student.find({
            classId: new mongoose.Types.ObjectId(classId),
            schoolId: schoolObjectId,
          }).select("_id");
          const studentIds = studentsInClass.map((s) => s._id);
          attendanceMatch.studentId = { $in: studentIds };
        }

        const attendanceSummary = await Attendance.aggregate([
          { $match: attendanceMatch },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);

        const attendance = {
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          totalRecords: 0,
        };
        attendanceSummary.forEach((item) => {
          if (item._id && typeof item._id === "string") {
            const status = item._id.toLowerCase();
            if (status in attendance) {
              (attendance as any)[status] = item.count;
              attendance.totalRecords += item.count;
            }
          }
        });

        // --- 3. Financial Summary ---
        const paymentMatch: any = {
          schoolId: schoolObjectId,
          paymentDate: { $gte: start, $lte: end },
        };
        if (classId && mongoose.Types.ObjectId.isValid(classId)) {
          paymentMatch.classId = new mongoose.Types.ObjectId(classId);
        }

        const financialSummary = await FeePayment.aggregate([
          { $match: paymentMatch },
          {
            $group: { _id: null, totalCollected: { $sum: "$totalAmountPaid" } },
          },
        ]);

        const financial = {
          totalCollectedInPeriod: financialSummary[0]?.totalCollected || 0,
        };

        // --- 4. Combine and Send Report ---
        const report = {
          dateRange: { startDate, endDate },
          attendance,
          financial,
          studentCount,
        };

        res.status(200).json(report);
      } catch (error: any) {
        console.error("Operations Report Error:", error);
        res
          .status(500)
          .json({ message: "Server error generating operations report." });
      }
    },
  );

  // --- 9. ACADEMICS API ENDPOINTS ---

  // --- Exam Management (CRUD) ---
  router.get(
    "/exams",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const exams = await Exam.find({ schoolId }).sort({
          academicYear: -1,
          name: 1,
        });
        res.status(200).json(exams);
      } catch (error) {
        console.error("Get Exams Error:", error);
        res.status(500).json({ message: "Server error fetching exams." });
      }
    },
  );

  router.post(
    "/exams",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const { name, academicYear } = req.body;

        if (!name || !academicYear) {
          return res
            .status(400)
            .json({ message: "Name and Academic Year are required." });
        }

        const newExam = new Exam({
          schoolId,
          name,
          academicYear,
        });

        await newExam.save();
        res.status(201).json(newExam);
      } catch (error: any) {
        if (error.code === 11000) {
          return res
            .status(400)
            .json({
              message:
                "An exam with this name already exists for this academic year.",
            });
        }
        console.error("Create Exam Error:", error);
        res.status(500).json({ message: "Server error creating exam." });
      }
    },
  );

  router.delete(
    "/exams/:id",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const { id } = req.params;

        // Check if any grades are associated with this exam
        const gradeCount = await Grade.countDocuments({
          examId: id,
          schoolId: schoolId,
        });
        if (gradeCount > 0) {
          return res
            .status(400)
            .json({
              message: `Cannot delete exam: ${gradeCount} grade(s) are already associated with it.`,
            });
        }

        const result = await Exam.deleteOne({ _id: id, schoolId: schoolId });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Exam not found." });
        }

        res.status(200).json({ message: "Exam deleted successfully." });
      } catch (error: any) {
        console.error("Delete Exam Error:", error);
        res.status(500).json({ message: "Server error deleting exam." });
      }
    },
  );

  // --- Grade/Marks Management ---
  router.get(
    "/grades",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const { examId, classId, subject } = req.query;

        if (!examId || !classId || !subject) {
          return res
            .status(400)
            .json({ message: "examId, classId, and subject are required." });
        }

        // Find all grades matching the filter
        const grades = await Grade.find({
          schoolId,
          examId: examId as string,
          classId: classId as string,
          subject: subject as string,
        }).populate("studentId", "fullName rollNumber"); // Populate student info

        res.status(200).json(grades);
      } catch (error) {
        console.error("Get Grades Error:", error);
        res.status(500).json({ message: "Server error fetching grades." });
      }
    },
  );

  router.post(
    "/grades/bulk",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const gradesData: any[] = req.body; // Expect an array of grade objects

        if (!Array.isArray(gradesData) || gradesData.length === 0) {
          return res
            .status(400)
            .json({ message: "A non-empty array of grades is required." });
        }

        // Use bulkWrite for efficient upsert operations
        const operations = gradesData.map((grade) => {
          // Basic validation for each item
          if (
            !grade.studentId ||
            !grade.classId ||
            !grade.examId ||
            !grade.subject ||
            grade.obtainedMarks == null
          ) {
            throw new Error(
              "Each grade entry must have studentId, classId, examId, subject, and obtainedMarks.",
            );
          }

          return {
            updateOne: {
              filter: {
                // The unique combination
                schoolId: schoolId,
                studentId: grade.studentId,
                examId: grade.examId,
                subject: grade.subject,
              },
              update: {
                $set: {
                  classId: grade.classId,
                  totalMarks: grade.totalMarks || 100, // Default to 100
                  obtainedMarks: grade.obtainedMarks,
                  remarks: grade.remarks || "",
                },
              },
              upsert: true, // This is the magic: update if exists, insert if not
            },
          };
        });

        const result = await Grade.bulkWrite(operations);

        res.status(200).json({ message: "Grades saved successfully.", result });
      } catch (error: any) {
        console.error("Bulk Save Grades Error:", error);
        if (error.message.includes("must have studentId")) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error saving grades." });
      }
    },
  );

  /**
   * @route GET /api/reports/report-card
   * @desc Gets all grades for a specific student and exam
   * @query studentId (required)
   * @query examId (required)
   */
  router.get(
    "/reports/report-card",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId } = (req as any).user as UserPayload;
        const { studentId, examId } = req.query;

        if (!studentId || !examId) {
          return res
            .status(400)
            .json({ message: "studentId and examId are required." });
        }

        // Find all grades matching the student and exam
        const grades = await Grade.find({
          schoolId,
          studentId: studentId as string,
          examId: examId as string,
        }).sort({ subject: 1 }); // Sort by subject name

        // Also fetch the student and exam details for the report card header
        const student = await Student.findById(studentId).populate(
          "classId",
          "name section",
        );
        const exam = await Exam.findById(examId);

        if (!student || !exam) {
          return res
            .status(404)
            .json({ message: "Student or Exam not found." });
        }

        res.status(200).json({
          student,
          exam,
          grades,
        });
      } catch (error) {
        console.error("Get Report Card Error:", error);
        res
          .status(500)
          .json({ message: "Server error fetching report card data." });
      }
    },
  );

  // --- 10. SUPER-ADMIN ENDPOINTS ---
  /**
   * @route GET /api/super-admin/schools
   * @desc (SuperAdmin Only) Gets a list of all schools on the platform.
   */
  router.get(
    "/super-admin/schools",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { role } = (req as any).user as UserPayload;

        // --- SECURITY CHECK ---
        if (role !== "SuperAdmin") {
          return res.status(403).json({ message: "Forbidden: Access denied." });
        }

        // --- UPDATED QUERY ---
        // Fetch all schools BUT filter out any with subscriptionTier "internal"
        const allSchools = await School.find({
          subscriptionTier: { $ne: "internal" },
        })
          .populate("ownerUserId", "fullName email") // Get owner's name/email
          .sort({ createdAt: -1 }); // Show newest first
        // --- END UPDATED QUERY ---

        res.status(200).json(allSchools);
      } catch (error: any) {
        console.error("Super-Admin Fetch Schools Error:", error);
        res.status(500).json({ message: "Server error fetching schools." });
      }
    },
  );

  /**
   * @route PUT /api/super-admin/schools/:schoolId/status
   * @desc (SuperAdmin Only) Updates a school's payment status.
   */
  router.put(
    "/super-admin/schools/:schoolId/status",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { role } = (req as any).user as UserPayload;
        const { schoolId } = req.params;
        const { paymentStatus } = req.body; // e.g., "active", "pending", "past_due"

        // --- SECURITY CHECK ---
        if (role !== "SuperAdmin") {
          return res.status(403).json({ message: "Forbidden: Access denied." });
        }
        if (!paymentStatus) {
          return res
            .status(400)
            .json({ message: "paymentStatus is required." });
        }

        const school = await School.findByIdAndUpdate(
          schoolId,
          { $set: { paymentStatus: paymentStatus } },
          { new: true }, // Return the updated document
        );

        if (!school) {
          return res.status(404).json({ message: "School not found." });
        }

        res.status(200).json(school); // Send back the updated school
      } catch (error: any) {
        console.error("Update School Status Error:", error);
        res
          .status(500)
          .json({ message: "Server error updating school status." });
      }
    },
  );

  /**
   * @route PUT /api/super-admin/schools/:schoolId/plan
   * @desc (SuperAdmin Only) Updates a school's subscription tier.
   */
  router.put(
    "/super-admin/schools/:schoolId/plan",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { role } = (req as any).user as UserPayload;
        const { schoolId } = req.params;
        const { subscriptionTier } = req.body; // e.g., "free", "basic", "premium"

        // --- SECURITY CHECK ---
        if (role !== "SuperAdmin") {
          return res.status(403).json({ message: "Forbidden: Access denied." });
        }
        if (!subscriptionTier) {
          return res
            .status(400)
            .json({ message: "subscriptionTier is required." });
        }

        const school = await School.findByIdAndUpdate(
          schoolId,
          { $set: { subscriptionTier: subscriptionTier } },
          { new: true }, // Return the updated document
        );

        if (!school) {
          return res.status(404).json({ message: "School not found." });
        }

        res.status(200).json(school); // Send back the updated school
      } catch (error: any) {
        console.error("Update School Plan Error:", error);
        res.status(500).json({ message: "Server error updating school plan." });
      }
    },
  );

  // --- CRITICAL UPDATE #2: ADD NEW ROUTE FOR SETUP WIZARD ---
  router.put(
    "/schools/my-school",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { schoolId, userId } = (req as any).user as UserPayload;
        const {
          address,
          phone,
          logoUrl,
          subscriptionTier,
          isOnboardingComplete,
        } = req.body;

        const school = await School.findById(schoolId);
        if (!school) {
          return res.status(404).json({ message: "School not found." });
        }

        // --- CORRECTED SECURITY CHECK ---
        if (!school.ownerUserId || school.ownerUserId.toString() !== userId) {
          console.warn(
            `AuthZ Failure: User ${userId} tried to update school ${schoolId} but is not the owner.`,
          );
          if (!school.ownerUserId) {
            console.log(
              `Assigning user ${userId} as new owner for school ${schoolId}`,
            );
            school.ownerUserId = new mongoose.Types.ObjectId(userId);
          } else {
            return res.status(403).json({
              message: "You are not authorized to perform this action.",
            });
          }
        }
        // --- END CORRECTION ---

        if (address !== undefined) school.address = address;
        if (phone !== undefined) school.phone = phone;
        if (logoUrl !== undefined) school.logoUrl = logoUrl;
        if (subscriptionTier !== undefined)
          school.subscriptionTier = subscriptionTier;
        if (isOnboardingComplete !== undefined)
          school.isOnboardingComplete = isOnboardingComplete;

        await school.save();

        res.status(200).json(school);
      } catch (error: any) {
        console.error("Update School Info Error:", error);
        res
          .status(500)
          .json({ message: "Server error updating school information." });
      }
    },
  );
  // --- END OF NEW ROUTE ---

  // Register all routes under the /api prefix
  app.use("/api", router);

  return app;
};

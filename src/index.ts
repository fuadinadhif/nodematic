import express, { Application, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import schedule from "node-schedule";
import { Resend } from "resend";
import path from "path";
import fs from "fs/promises";
import handlebars from "handlebars";

const app: Application = express();
const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());

app.get("/api/v1/health", (req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

app.post("/api/v1/users", async (req: Request, res: Response) => {
  const { name, email } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      res.status(409).json({ ok: false, error: "User already exists" });
      return;
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
      },
    });

    const scheduleDate = new Date(new Date().getTime() + 1000 * 5);

    const job = schedule.scheduleJob(scheduleDate, async () => {
      try {
        const templatePath = path.join(__dirname, "templates", "template.hbs");
        const templateSource = await fs.readFile(templatePath, "utf-8");
        const compiledTemplate = handlebars.compile(templateSource);
        const html = compiledTemplate({ name: newUser.name });

        const { data, error } = await resend.emails.send({
          from: "Admin <no-reply@killthemagic.dev>",
          to: newUser.email,
          subject: "Hi!",
          html,
        });

        if (error) {
          console.error(error);
        }
      } catch (error) {
        console.error(error);
      } finally {
        console.log("Job finished");
        job.cancel();
      }
    });

    // const job = schedule.scheduleJob(scheduleDate, () => {
    //   console.log(
    //     `Your name is ${newUser.name} and you registered exactly 1 minute a go!`
    //   );

    //   job.cancel();
    // });

    res.status(201).json({ ok: true });
  } catch (error) {
    console.log(error);
    res.status(500);
  }
});

// Schedule job to run every 2 seconds
// schedule.scheduleJob("*/2 * * * * *", () => {
//   console.log("Fire!");
// });

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});

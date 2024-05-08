import 'dotenv/config';

import bodyParser from 'body-parser';
import express from 'express';
import nodemailer from 'nodemailer'
import OpenAI from 'openai';

const openai = new OpenAI({apiKey : process.env.OPENAI_API_KEY});

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('../frontend'));

const guesses = [];
let actualActivity = '';

const adminPassword = process.env.ADMIN_PASSWORD;

app.post('/api/guess', (req, res) => {
  const {name, email, guess} = req.body;
  let matched =
      guesses.find((e) => { return e.name == name || e.email == email; });

  if (matched) {
    matched.name = name;
    matched.email = email;
    matched.guess = guess;

    console.log(`Updated guess: ${name}, ${email}, ${guess}`);
    res.status(200).json({message : 'Guess updated!'});
  } else {
    guesses.push({name, email, guess});
    console.log(`Received guess: ${name}, ${email}, ${guess}`);
    res.status(200).json({message : 'Guess received!'});
  }
});

app.post('/api/admin', async (req, res) => {
  const {password, actual} = req.body;
  if (password === adminPassword) {
    actualActivity = actual;
    console.log("Evaluating guesses...");
    await evaluateGuesses();
    res.status(200).json({success : true});
  } else {
    console.log("Received bad adminPassword");
    res.status(401).json({success : false});
  }
});

async function evaluateGuesses() {
  const scores = [];
  for (const guess of guesses) {
    const response = await openai.chat.completions.create({
      model : 'gpt-3.5-turbo',
      messages : [ {
        role : "system",
        content : `Evaluate the similarity between "${guess.guess}" and "${
            actualActivity}". Give a score out of 5, where 5 is very similar and 1 is not similar at all. As an example, a 4/5 similarity score would correspond to 'eating lunch' vs 'eating dinner'. A 1/5 similarity score would correspond to 'going for a run with friends' and 'watching a movie alone'. A 5/5 similarity score could be 'getting groceries' vs 'getting vegetables from the store', or 'going for a walk' vs 'going for a run' since these are similar. You can be a little generous with these scores, since it's very hard to guess what someone is doing at a given time. Do not return any output other than the score as a single digit.`
      } ],
    });
    const score = parseInt(response.choices[0].message.content.trim());
    scores.push({...guess, score});
  }

  sendResults(scores);
  guesses.length = 0; // Clear guesses for the next round
}

let count = 2;
function getDayNumber() { return count++; }

function emojiFor(score) {
  if (score < 2) {
    return "😭";
  } else if (score < 3) {
    return "😢";
  } else if (score < 4) {
    return "🙂";
  } else if (score < 5) {
    return "😄";
  } else {
    return "🎉";
  }
}

function sendResults(scores) {
  const dayNumber = getDayNumber();

  const start =
      `What is Mahua doing? The answer is... "${actualActivity}"!\n\n`;
  const ad =
      `Don't forget to <a href='http://198.199.83.100:3000/'>share</a> with your friends!!!!!\n\n`;
  const groupedResults =
      scores
          .map((score) => {
            const greenBoxes = '🟩'.repeat(score.score);
            const blackBoxes = '⬛'.repeat(5 - score.score);
            const result = `${score.name} guessed "${score.guess}"\n` +
                           `Wmdle #${dayNumber} ${score.score}/5\n` +
                           `${greenBoxes}${blackBoxes}${emojiFor(score.score)}`;
            return result;
          })
          .join('\n\n');
  const result = start + ad + groupedResults;

  const emails = new Set();
  for (const score of scores) {
    emails.add(score.email);
  }
  emails.add("reetahan@gmail.com");
  sendEmail(Array.from(emails), `WMDle #${dayNumber} Results`, result);
}

function sendEmail(to, subject, text) {
  const transporter = nodemailer.createTransport({
    service : 'gmail',
    auth : {user : process.env.GMAIL_USER, pass : process.env.GMAIL_PASS}
  });

  const mailOptions = {from : process.env.GMAIL_USER, to, subject, text};

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

app.listen(port, () => {
  console.log(`WMDle backend running on http://localhost:${port}`);
});

import 'dotenv/config';

import bodyParser from 'body-parser';
import express from 'express';
import * as fs from 'fs';
import nodemailer from 'nodemailer'
import OpenAI from 'openai';

const openai = new OpenAI({apiKey : process.env.OPENAI_API_KEY});

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('../frontend'));

let actualActivity = '';

const guesses = JSON.parse(fs.readFileSync("guesses"));
function addOrUpdateGuess(name, email, guess, onReceived, onUpdated) {
  let matched =
      guesses.find((e) => { return e.name == name || e.email == email; });

  if (matched) {
    matched.name = name;
    matched.email = email;
    matched.guess = guess;

    console.log(`Updated guess: ${name}, ${email}, ${guess}`);
    onUpdated();
  } else {
    guesses.push({name, email, guess});
    console.log(`Received guess: ${name}, ${email}, ${guess}`);
    onReceived();
  }

  fs.writeFileSync("guesses", JSON.stringify(guesses));
}

app.post('/api/guess', (req, res) => {
  const {name, email, guess} = req.body;
  addOrUpdateGuess(
      name, email, guess,
      /*onReceived=*/
      () => { res.status(200).json({message : 'Guess received!'}); },
      /*onUpdated=*/
      () => { res.status(200).json({message : 'Guess updated!'}); });
});

app.post('/api/admin', async (req, res) => {
  const {password, actual} = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    actualActivity = actual;
    console.log("Evaluating guesses...");
    await evaluateGuesses();
    res.status(200).json({success : true});
  } else {
    console.log("Received bad admin password");
    res.status(401).json({success : false});
  }
});

async function evaluateGuesses() {
  const scores = [];
  for (const guess of guesses) {
    const response = await openai.chat.completions.create({
      model : 'gpt-4',
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

let count = parseInt(fs.readFileSync("counter"));
function getDayNumber() {
  const retval = count;
  count++;
  fs.writeFileSync("counter", count.toString());
  return retval;
}

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
      `What is Mahua doing? The answer is... "${actualActivity}"!<br><br>`;
  const ad =
      `Don't forget to <a href='http://198.199.83.100:3000/'>share</a> with your friends!!!!!<br><br>`;
  const groupedResults =
      scores
          .map((score) => {
            const greenBoxes = '🟩'.repeat(score.score);
            const blackBoxes = '⬛'.repeat(5 - score.score);
            const result = `${score.name} guessed "${score.guess}"<br>` +
                           `Wmdle #${dayNumber} ${score.score}/5<br>` +
                           `${greenBoxes}${blackBoxes}${emojiFor(score.score)}`;
            return result;
          })
          .join('<br><br>');
  const result = `<p>` + start + ad + groupedResults + `</p>`;

  const emails = new Set();
  for (const score of scores) {
    emails.add(score.email);
  }
  emails.add("reetahan@gmail.com");
  sendEmail(Array.from(emails), `WMDle #${dayNumber} Results`, result);
}

function sendEmail(to, subject, html) {
  const transporter = nodemailer.createTransport({
    service : 'gmail',
    auth : {user : process.env.GMAIL_USER, pass : process.env.GMAIL_PASS}
  });

  const mailOptions = {from : process.env.GMAIL_USER, to, subject, html};

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

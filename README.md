# SlackScheduler

The Slack Scheduler bot is a language aware intelligent slack bot for scheduling reminders and meetings with other slack users in google calendar. 

The Slack Scheduler bot is built using many asynchronous API's, making it very difficult to maintain state across multiple users. The three core APIs used are Slack RTM, API.AI, and Google Calendar API. When the slack bot is sent a message, it is immedaitely sent to API.AI where multiple intents are already set up to parse the input and decide how to respond based off of the users input. For example, if you were to input "Schedule a meeting with *a person* at *time* on *date or today/tomorrow/etc* to discuss *a meeting topic* for *one hour*". If any of the italic fields are missing, the response will ask for the user for the specific field. Duration is not required, but will default to 30 minutes if not included.
  
```Example:  
User: "Schedule a meeting with @arayan tomorrow"  
Bot: "What Time?"  
User: "5pm"  
Bot: "What will be the topic of the meeting?"  
User: "Machine Learning"  
Bot: "Confirm meeting"  
Bot: "Meeting Confirmed"  
```
  
  
The scheduler bot will then check to see if it has permissions to add events to both users calendar. If it doesnt, it will inform the user to have the user message the bot and the bot will send the user a link to give the bot permission to edit thier calendar.  
  
If all permissions are set, it will then check both users calendars to see if there any prexisting conflicts with any of the users calendars.  
If there are, the bot will then respond, letting the user know there are time conflicts, and then will prompt the user to pick a new time from a list of first 10 available meeting slots that work for every user invited to the meeting. This is limited to 3 free times per day, and will check up to 7 business days ahead of time for these free times. It will check for free times for the duration of the meeting, if provided. If not provided, it will default to 30 minute free slots.  
The user will select the best time and the bot will then schedule the meeting, adding the event to all users calendars and sending each user and email. 
  
The scheduler bot can also create reminders for users. Using the same process as scheduling, the bot will set a reminder in the users calendar. These reminders are also added to an internal list of reminders that the scheduler will remind  the user of the task at midnight, and the user will see the reminder in their slack Direct Messages when they next open slack. This is done through the `script.js` file, Heroku's script scheduler, acting as a cron job to fire every night at midnight.  
  
```Example:  
User: "Remind me to turn in progress report"  
Bot: "When should I remind you?"  
User: "Tomorrow"  
Bot: "Confirm reminder"  
Bot: "Reminder Set"  
```
## Running the tests

Since I am using the free version of Heroku, the server will automatically sleep after 12 hours. To test the application, simply deploy the project to heroku, set the Heroku address with the */slack/interactive* endpoint to the request URL for interactive messages in the Slack API application dashboard. 
  
You will also need to set up a mongodb. Instructions on how to do this can be found [here.](http://fredrik.anderzon.se/2017/01/17/setting-up-a-free-mongodb-database-on-mlab-and-connecting-to-it-with-node-js/)  

Finally, set all of your environmental variables in heroku. You will need the following names for your environment variables:  
API_AI_TOKEN: *Your API.AI token*  
CLIENT_ID: *Your Slack credentials*  
CLIENT_SECRET: *Your Slack credentials*  
DOMAIN: *Heroku domain name*  
GOOGLE_CLIENT_ID: *Google API Credentials*  
GOOGLE_CLIENT_SECRET: *Google API Credentials*  
MONGODB_URI: *Mongo DB credentials*  
SLACK_API_TOKEN: *Bot User OAuth Access Token*  

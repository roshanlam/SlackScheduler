var mongoose = require('mongoose');
var {Reminder} = require('./models');
mongoose.connect(process.env.MONGODB_URI);
var _ = require('underscore');
var bluebird = require('bluebird')

var {RtmClient, CLIENT_EVENTS, RTM_EVENTS} = require('@slack/client');
// same as var RtmClient = require('@slack/client').RtmClient

var token = process.env.SLACK_API_TOKEN || '';

var rtm = new RtmClient(token);
// var web = new WebClient(token);
rtm.start();

findReminders(rtm);


function postMessage( msg, channelId) {
    return new Promise(function(resolve, reject){
        rtm.sendMessage('message body',channelId, function(err) {
            if(err) {
                reject(err);
            } else {
                resolve();
            }
        })
    })
}

var promisifiedPostMessage = bluebird.promisify(rtm.sendMessage.bind(rtm)) //USE EITHER THIS OR MY DEFINITION OF POSTMESSAGE

function findReminders(rtm){
  var now = Date.now();
  var tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).getTime();
  Reminder.find({}).where('date').gt(now).lt(tomorrow)
  .populate('userID')
  .then(function(reminders) {
      var groupedReminders = _.groupBy(reminders, function(reminder) {
          // console.log('REMINDER IN GROUPEDREMINDER IS', reminder);
          return reminder.userID._id
      });
      var promises = Object.keys(groupedReminders).map(function(reminder) {
          var userReminders = groupedReminders[user];
          var reminderString = "";
          var channel;
          userReminders.forEach(function(reminder) {
              channel = reminder.channelID;
              // var dmChannel = rtm.dataStore.getDMByUserId(reminder.userID.slackID);
              var date = new Date(reminder.date);
              var str = `Reminder: ${date} for ${reminder.subject} \n`;
              reminderString+= str;
          })
          // console.log('sending remidner string to user ', reminderString);
          // console.log('rtm issss', rtm);
          return promisifiedPostMessage(reminderString, channel); //ORRR JUST CALL MY POSTMESSAGES
      })
      return Promise.all(promises);
  })
  .then((promises) => {

      console.log('successs SENDING REMIDNERS');
      process.exit(0)
  })
  .catch((err) => {
      console.log('ERROR SENDING REMINDERS');
      process.exit(0);
  })
}

var logger = require('morgan');
var google = require('googleapis');
var {User, Reminder, Meeting} = require('./models')
var OAuth2 = google.auth.OAuth2;
var mongoose = require('mongoose');
var _ = require('underscore');
var models = require('./models');
var googleAuth = require('google-auth-library');
var fs = require('fs');
var slackID;
var url;
var {rtm, web} = require('./rtm-client')

mongoose.connect(process.env.MONGODB_URI);
mongoose.Promise = global.Promise;
// var googleAuth = require('google-auth-library');
var express = require('express');
require('./rtm-client');
var app = express();
var bodyParser = require('body-parser');
app.use(logger('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
// var app = express();

var {RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS} = require('@slack/client');
var CLIENT_ID = process.env.CLIENT_ID;
var CLIENT_SECRET = process.env.CLIENT_SECRET;
const PORT=3000;
app.get('/oauth', function(req, res){
    oauth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/connect/callback'
    )
    url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'email',
            'https://www.googleapis.com/auth/calendar'
        ],
        state: encodeURIComponent(JSON.stringify({
            auth_id: req.query.auth_id
        }))
    });
    slackID = req.query.auth_id
    res.redirect(url);
})

app.get('/connect/callback', function(req, res) {
    const code = req.query.code;
    oauth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/connect/callback'
    )
    console.log("this is oauth", oauth2Client);
    oauth2Client.getToken(code, function (err, tokens) {
        if(err) {
            console.log(err)
        } else {
            //set credentials. not entirely sure what this does but necessary for google plus
            //when a person gives access to their google calendar, we also make a request to google plus
            //with their oauth2client in order to get their email address which is then saved in the user object
            //in mongodb.
            oauth2Client.setCredentials(tokens);
            console.log("this is tokens", tokens);
            var plus = google.plus('v1');
            plus.people.get({auth: oauth2Client, userId: 'me'}, function(err, person){
                if(err){
                    console.log(err)
                } else {
                    //when a person
                    console.log("this is googleplus person object", person);
                    var tempEmail = person.emails[0].value;
                    let auth_id = JSON.parse(decodeURIComponent(req.query.state));
                    var newUser = new User({
                        token: tokens,
                        slackID: slackID, 
                        // TODO: store slackname so that you can easily add your own meetings to your calendars too
                        auth_id: auth_id.auth_id,
                        email: tempEmail,
                        pendingInvites: []
                    });
                    newUser.save()
                    .then( () => res.status(200).send("Your account was successfully authenticated"))
                    .catch((err) => {
                        console.log('error in newuser save of connectcallback');
                        res.status(400).json({error:err});
                    })
                }
            });
        }
    });
})
// This route handles GET requests to our root ngrok address and responds with the same "Ngrok is working message" we used before
app.get('/', function(req, res) {
    res.send('Ngrok is working! Path Hit: ' + req.url);
});
// Route the endpoint that our slash command will point to and send back a simple response to indicate that ngrok is working
app.post('/command', function(req, res) {
    res.send('Your ngrok tunnel is up and running!');
});

app.post('/slack/interactive', function(req,res){
    var payload = JSON.parse(req.body.payload);
    console.log('PAYLOAD ACTIONS', payload);
    //if the user selects confirm button
    if(payload.actions[0].value !== 'false') {
        // else if(payload.actions[0].type === "button" && payload.actions[0].value !== 'false') {
        slackID = payload.user.id;
        User.findOne({slackID: slackID}).exec(function(err, user){
            if(err || !user){
                console.log(err);
                res.send('an error occured');
            } else if (user){

                var payloadArr = payload.original_message.attachments;

                if(payload.original_message.text === "Would you like me to create a reminder for "){
                    //it was a reminder
                    console.log('reminder message payload', payload.original_message.attachments[0]);
                    var reminderSubject = payload.original_message.attachments[0].fields[0].value;
                    var reminderDate = Date.parse(payload.original_message.attachments[0].fields[1].value);
                    console.log('rEMINDER DATE IS ', reminderDate, payload.original_message.attachments[0].fields[1].value);
                }
                else{
                    var meetingDuration = 30; //default meeting duration is 1 hour
                    console.log('meeting duration after some stuff idk what its doing ', meetingDuration);
                    var meetingSubject = payload.original_message.attachments[0].fields[0].value;
                    var meetingInvitees = payload.original_message.attachments[0].fields[1].value.split(",");
                    if(payload.actions[0].type === "select"){ //meeting with conflicts with select list
                        var newSplit = payload.actions[0].selected_options[0].value.split('T')
                        var converted = new Date(newSplit[0] + 'T' + newSplit[1].substring(0,newSplit[1].length-1)+ "+07:00").toISOString();
                        var meetingTime = converted.slice(11,19);
                        var meetingDate = converted.slice(0,10)
                        if(payloadArr[0].fields[2]) {
                            console.log('meeting duration field was ', payloadArr[0].fields[2]);
                            //the duration field was provided
                            let durArr = payloadArr[0].fields[2].value.split(" ");
                            if(durArr[1] === "h") {
                                meetingDuration = durArr[0] * 60;
                            } else {
                                meetingDuration = durArr[0]
                            }
                        }
                    }
                    else { //it was a meeting that had no conflicts
                        var meetingDate = payload.original_message.attachments[0].fields[2].value;
                        var meetingTime = payload.original_message.attachments[0].fields[3].value;
                        if(payloadArr[0].fields[4]) {
                            console.log('meeting duration field was ', payloadArr[0].fields[4]);
                            //the duration field was provided
                            let durArr = payloadArr[0].fields[4].value.split(" ");
                            if(durArr[1] === "h") {
                                meetingDuration = durArr[0] * 60;
                            } else {
                                meetingDuration = durArr[0]
                            }
                        }
                    }
                }

                oauth2Client = new OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET,
                    process.env.DOMAIN + '/connect/callback'
                )
                oauth2Client.setCredentials({
                    refresh_token: user.token.refresh_token
                });
                oauth2Client.refreshAccessToken(function(err, tokens) {
                    user.token = tokens;
                    user.save()
                    .then((user)=>{
                        if(payload.original_message.text === "Would you like me to create a reminder for "){
                            //it was a reminder
                            var newReminder = new Reminder({
                                userID: user._id,
                                channelID: payload.channel.id,
                                subject: reminderSubject,
                                date: reminderDate,
                            })
                            newReminder.save(function(err){
                                if (err){
                                    res.status(400).json({error:err});
                                }else{
                                    reminderDate = new Date(reminderDate);
                                    createCalendarReminder(reminderDate.toISOString().substring(0, 10), reminderSubject, user.token);
                                    res.send('Reminder Confirmed');
                                }
                            })
                        } else {
                            //it was a meeting
                            var newMeeting = new Meeting({
                                userID: user._id,
                                channelID: payload.channel.id,
                                subject: meetingSubject,
                                date: meetingDate,
                                time: meetingTime,
                                invitees: meetingInvitees,
                                duration: meetingDuration,
                            })
                            newMeeting.save(function(err, meeting){
                                if (err){
                                    res.send('Error saving meeting');
                                }else{
                                    //TODO: instead of first finding the requestors slackname, correctly save it in their mongo object so u dont need to do  find (since inside find email function you need the user not just the name, so pretty uncesssary to do a find name here)
                                    //meetingInvitees.concat([user.slackName])
                                    let requester = rtm.dataStore.getUserById(user._id);
                                    if(requester) {

                                        findAndReturnEmails(meetingInvitees.concat([requester.name]), meetingDate,  meetingSubject, user.token, meetingTime, meeting.duration);
                                    } else { //if for some reason we cant retrieve the infromation about the requestor
                                        console.log('couldnt get information about the user requesting the meeting');
                                        findAndReturnEmails(meetingInvitees, meetingDate,  meetingSubject, user.token, meetingTime, meeting.duration);
                                    }
                                    res.send('Meeting confirmed');
                                }
                            })
                        }
                    })
                });
            }
        })
    } else {
        res.send('Cancelled');
    }
})
app.listen(process.env.PORT || 3000);

function createCalendarReminder(date, subject, tokens, invitees, time, duration){
    if(!invitees){
        let dateTime = date + "T" + time + "-07:00"
        var event = {
            'summary': subject,
            'start': {
                'date': date,//Time,
            },
            'end': {
                'date': date,//Time
            }
        };
    } else {
        let attendeesArr = [];
        invitees.forEach((invited) => {
            attendeesArr.push({
                'email' : invited
            })
        })
        let dateTime = date + "T" + time + "-07:00"

        var endTime = new Date(dateTime);
        endTime.setMinutes(endTime.getMinutes() + parseInt(duration))
        let finalDate = new Date(Date.parse(endTime))

        var event = {
            'summary': subject,
            'start': {
                'dateTime': dateTime
            },
            'end': {
                'dateTime': finalDate,
            },
            'attendees': attendeesArr,
        };
    }

    oauth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/connect/callback'
    )
    oauth2Client.setCredentials(tokens);
    var calendar = google.calendar('v3');
    calendar.events.insert({
        auth: oauth2Client,
        calendarId: 'primary',
        resource: event,
    }, function(err, event) {
        if(err){
            console.log("There was an error adding the calendar", err);
            return
        }else {
            console.log('event created')
        }
    })
}


function findAndReturnEmails (users, date, subject, tokens, time, duration) {

    var slackIdArray = [];

    users.forEach((username) => {
        let userObj = rtm.dataStore.getUserByName(username);
        slackIdArray.push(userObj.id);
    })

    var emailArray = [];
    var promisArray = [];

    slackIdArray.forEach((slackId) => {
        promisArray.push(User.findOne({slackID: slackId}).exec()
        .then((user) => user.email))
    })

    Promise.all(promisArray).then((arr) => {
        if(arr) {
            createCalendarReminder(date, subject, tokens, arr, time, duration);
        } else {
            //idk when this happened but it did once
            console.log('in find and return emails, invitees came to be falsy so not calling createCalendarReminder', arr);
        }
    })
}


function sendInvitations(meeting, user){

    //// old and redundant code
    //// get the invitor's userObj from dataStore
    //// var sender = rtm.dataStore.getUserById(meeting.userID)
    //// find the user by his slackId in the mongodb
    //// User.findOne({slackID: }).exec()
    //// .then((user) => user.pendingInvites = meeting.invitees)

    // 1. add invitees to invitor's pending invites array
    //user that created event and is sending invitations's object gets passed into this function
    user.pendingInvites = meeting.invitees;
    console.log("this is updated pendingInvites", user.pendingInvites);
    user.save()
    .then( () => res.status(200).send("pendingInvites array updated"))
    .catch((err) => {
        console.log('error in saving pendinginvites array to mlabs');
        res.status(400).json({error:err});
    })

    // 2.  get UserId and DM ID from the slack usernames in meeting.invitees =>
    //     check link pam sent in general
    let tempArr = [];
    user.pendingInvites.forEach((invitee) => {
        let xyz = rtm.dataStore.UserByName(invitee)
        console.log("this is UserByName", xyz)
    })



    // var abc = rtm.dataStore.getDMByUserId()
    // tempArr.push(abc);
    // 3. for each invitee send web.chat.postmessage invitation message
    // findAndReturnEmails(meeting.invitees, meeting.date,  meeting.subject, tokens, meeting.time);

}

// when slack user confirms, write new route in /slack/interactive to receive that payload with the information in it
// when they accept, remove their name from the pendingInvites array and check the array's length
// if the array's length is 0, then call create the calendar event

// TODO: how to handle invites who decline. just remove them from pending invites array, and send slack messages
// saying "usernameX declined to attend the meeting", then check array lenght and book calender event with those remaining

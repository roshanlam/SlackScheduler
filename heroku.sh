#!/bin/bash

cd /Users/Roshan/Documents/slack-scheduler

echo "--Adding--"

env -i git add .
echo "--Committing--"

env -i git commit -m 'heroku commit'
echo "--Pushed--"

env -i git push heroku pamreminders:master
echo "--Completed--"

#Define base image
FROM node:8
#Define App directory
WORKDIR /home/aman/ServerContainer/ServerApp
#Image comes with nodejs and npm pre-installed. Will have to install mysql separately
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production
# Bundle app source
COPY . .
#App binds to port 8000
EXPOSE 8000
#App also binds to mysql port... TODO. OK, seems like EXPOSE defines a port to LISTEN on, so later. 
#EXPOSE 3306
#Run the app
CMD [ "npm", "start" ]
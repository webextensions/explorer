# Explorer
Explorer - Folders & files

# Local - Setup
* Copy `./backend/.env.sample.env` to `./backend/.env`
* In `./backend/.env`, set the appropriate API key values

Notes:
* The file `./backend/.env` is ignored from the Git repository

# Local - Run
* `$ npm start`
* Visit the URL in which the application is running, eg: http://localhost:3000/

Notes:
* This application should be loaded from a [Secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts). eg: `https://` or `localhost` or `.localhost` based URLs
* To run multiple instances of this application (by avoiding port conflict), execute:  
  `$ npm run start:port-dynamic`

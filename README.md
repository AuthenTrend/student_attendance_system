## Students Attendance System

The project is a school-based example where you can add campus-related information, including classes, teachers and students.
Further, teachers can allow students to sign in classes using WebAuthn authentication with FIDO2 Security Keys on supported browsers and view the attendance records from the website afterward.

### Development

This project is developed base on an open source project [webauthntest](https://github.com/microsoft/webauthntest).
The original License was moved to ORIGINAL_LICENSE.md and update a new GPLv3 License.

### Requirement

- NodeJS >= 10.21
- MongoDB

### Files

UI is under
```frontend/```
full server package is under
```src/```

### UI modify and setup

UI need package manage tool yarn.
You can install the tool with
```npm install -g yarn```

UI is written in Vue.js framework.
After changing any content, you can run
```sh frontend/develop/build.sh``` on Linux, or
```zsh frontend/develop/build.sh``` on Mac

and all modifications will update to 
```src/public/```

### First Run Server

Before startup server application, you need to install npm modules.
Run ```npm install --save``` under src/

And setup executing environment parameters so it won't return an error when you try to register a new security key.
```
echo 'SERVER_HOSTNAME={CERTIFICATE_URL_NAME}' >> src/.env
```

Now you can run ```npm start``` in src/ and see the service

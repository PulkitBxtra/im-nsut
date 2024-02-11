
const express = require('express');
const request = require('request');
const cheerio = require('cheerio');
const dotenv = require('dotenv');
const shelve = require('shelve');

dotenv.config({ path: '.env' });

class Ims {
  constructor() {
    this.username = process.env.imsUsername;
    this.password = process.env.imsPassword;

    this.baseHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.119 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      // 'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
    };
    this.baseUrl = 'https://www.imsnsit.org/imsnsit/';

    const [session, profileUrl, myActivitiesUrl, allLinks] = this.getSession();
    this.session = session;
    this.profileUrl = profileUrl;
    this.myActivitiesUrl = myActivitiesUrl;
    this.allLinks = allLinks;

    this.isAuthenticated = false;
  }

  getSession() {
    try {
      const file = shelve.open('session_object');
      const session = file['session'];
      const profileUrl = file['profile_url'];
      const myActivitiesUrl = file['activities_url'];
      const allUrls = file['urls'];
      file.close();
      return [session, profileUrl, myActivitiesUrl, allUrls];
    } catch (error) {
      console.error(error);
      const session = request.session();
      session.headers.update(this.baseHeaders);
      return [session, '', '', {}];
    }
  }

  isUserAuthenticated() {
    try {
      const response = this.session.get(this.profileUrl);
      if (response.includes('Session expired')) {
        return false;
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  storeSession() {
    const data = {
      'session': this.session,
      'profile_url': this.profileUrl,
      'activities_url': this.myActivitiesUrl
    };
    this.store(data);
  }

  store(data) {
    try {
      const file = shelve.open('session_object');
      for (const [key, value] of Object.entries(data)) {
        file[key] = value;
      }
      file.close();
    } catch (error) {
      console.error(error);
    }
  }

  authenticate(force = false) {
    if (!force) {
      if (this.isUserAuthenticated()) {
        this.isAuthenticated = true;
        return;
      }
    }

    const self = this; // Store reference to 'this' for use in callback

    this.session.get(this.baseUrl, { headers: this.baseHeaders }, (error, response, body) => {
      if (error) {
        console.error(error);
        return;
      }

      self.session.headers.update({
        'Referer': 'https://www.imsnsit.org/imsnsit/student_login.php',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://www.imsnsit.org',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'frame',
      });

      // Continue with your logic, making another request, etc.
    });
  }

  getAllUrls() {
    try {
      const camelCase = (s) => {
        s = s.replace(/(_|-)+/g, " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        return s.charAt(0).toLowerCase() + s.slice(1);
      };

      const response = this.session.get(this.myActivitiesUrl);
      const $ = cheerio.load(response);
      const uncleanUrls = $('a');
      const links = {};

      uncleanUrls.each((index, element) => {
        const link = $(element);
        if (link.attr('href') !== '#') {
          let key = link.text().replace(/[^0-9a-zA-Z]+/g, ' ');
          key = camelCase(key);
          links[key] = link.attr('href');
        }
      });

      this.store({ 'urls': links });
      this.allLinks = links;
    } catch (error) {
      console.error(error);
    }
  }
}

class User {
  constructor() {
    this.ims = new Ims();
    this.ims.authenticate();
  }
}

const app = express();

const user = new User();

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

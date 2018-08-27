const Puppeteer = require("puppeteer");
const Axios = require("axios");

const USERNAME = "xxxxxxxxxxxxx";
const PASSWORD = "xxxxxxxxxxxxx";
const SHOWROOM = "https://www.showroom-live.com";

// const PUPPET_SETTINGS = {
//   headless: false,
//   slowMo: 48
// }

const GENRES_WITH_STARS = [
  "Popularity",
  "Idol",
  "Talent Model",
  "Music",
  "Voice Actors & Anime",
  "Comedians/Talk Show"
];

const GIFT_SELECTOR = "#room-gift-item-list li.room-gift-item div.gift-free-num-label";

const freeGiftsAreSeeds = async (page) => {
  return await page.$$eval("#room-gift-item-list li.room-gift-item img.gift-image", (gifts) => {
    return gifts.
      slice(0,5).
      map((node) => { return node.src }).
      // does it include an image of a seed?
      includes("https://image.showroom-live.com/showroom-prod/assets/img/gift/1501_s.png?1534816304");
  });
};

const generateUnixTimestamp = () => {
  return Math.round((new Date()).getTime() / 1000);
};

const getRooms = async () => {
  return await Axios.get(`https://www.showroom-live.com/api/live/onlives?_=${generateUnixTimestamp()}`).
    then((r) => { 
      return r.data["onlives"].reduce((acc, genre) => { 
        if (GENRES_WITH_STARS.includes(genre["genre_name"])) {
          genre["lives"].forEach((room) => { acc.push(room["room_url_key"]); });

          return acc;
        } else {
          return acc;
        }
      }, []);

    }).catch((error) => {
      console.log(error);
    });
};

const seconds = (timeInSeconds) => {
  return timeInSeconds * 1000;
};

const countTheStars = async (page) => {
  return await page.$$eval(GIFT_SELECTOR, (stars) => {
    return stars.
      slice(0,5).
      map((node) => { return parseInt(node.textContent.replace(/[^0-9]+/g, ""))});
  });
};

const streamStillLive = async (room_url_key) => {
  return await Axios.get(`https://www.showroom-live.com/api/room/status?room_url_key=${room_url_key}`).
    then((r) => { return r.data["is_live"]; }).
    catch((error) => { console.log(error); })
};

(async () => {
  // Initialize Puppeteer
  const browser = await Puppeteer.launch(PUPPET_SETTINGS);
  const page = await browser.newPage();

  // Login to my account
  await page.goto(SHOWROOM);
  await page.click("a[onclick='showLoginDialog();']")
  await page.click("#js-login-form input[name='account_id']")
  await page.keyboard.type(USERNAME)
  await page.click("#js-login-form input[name='password']")
  await page.keyboard.type(PASSWORD)
  await page.click("#js-login-form #js-login-submit")

  // Let the party begin
  var rooms = await getRooms();
  var areStarsFull = false;

  while (rooms.length > 0 && areStarsFull == false) {
    let currentRoom = rooms.shift();
    let roomUrl = `${SHOWROOM}/${currentRoom}`;

    if (await streamStillLive(currentRoom)) {
      console.log(`Visiting ${roomUrl}`);
      await page.goto(roomUrl);
      await page.waitFor(GIFT_SELECTOR);

      if (await freeGiftsAreSeeds(page)) {
        console.log(`${roomUrl} has seed gifts and not stars, skipping...`)
        continue;
      } else {
        await page.waitFor(seconds(33));

        let starCount = await countTheStars(page);
        console.log(`Stars are now at: ${starCount}`);

        areStarsFull = starCount.every((count) => { return count == 99 });
      }
    } else {
      console.log(`Broadcast for ${roomUrl} has ended, skipping...`);
    }

    if (areStarsFull == true) {
      console.log("\nDONE");
      await browser.close();
      break;
    } else if (rooms.length == 0 && areStarsFull == false) {
      rooms = await getRooms();
    }
  }
})();
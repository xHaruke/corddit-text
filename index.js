const snoowrap = require("snoowrap");
const cron = require("node-schedule");
const oceanic = require("oceanic.js");
const config = require("./config.js");
const { QuickDB } = require("quick.db");

const r = new snoowrap({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.4; WOW64) AppleWebKit/602.11 (KHTML, like Gecko) Chrome/51.0.1206.147 Safari/537.4 Edge/16.65574",
  clientId: config.reddit.clientID,
  clientSecret: config.reddit.clientSecret,
  username: config.reddit.username,
  password: config.reddit.password,
});

const client = new oceanic.Client({
  auth: config.token,
  gateway: {
    intents: ["GUILDS", "GUILD_MESSAGES", "MESSAGE_CONTENT"],
    presence: {
      activities: [{ name: "Spamming reddit's API!", type: 0 }],
      status: "idle",
    },
  },
});
const db = new QuickDB();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let alreadyWorking = false;

client.on("ready", async () => {
  console.log("Ready as", client.user.tag);

  console.log("DB connected.");

  const job = cron.scheduleJob("0 */6 * * *", loopCreatePosts);

  await loopCreatePosts();
});

client.on("error", (err) => {
  console.error("Something Broke!", err);
});

setInterval(() => {
  alreadyWorking = false;
}, 69 * 60 * 1000);

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() == "--forcefetch") {
    if (!message.member.permissions.has("ADMINISTRATOR")) {
      return message.channel.createMessage({
        content:
          "You require the `ADMINISTRATOR` permission to create a setup config.",
      });
    } else {
      if (alreadyWorking === true)
        return message.channel.createMessage({
          content: '"alreadyWorking" was set to "true", igoring task.',
        });

      message.channel.createMessage({ content: "Starting task..." });
      console.log("Running forceFetch!");
      await loopCreatePosts();
      message.channel.createMessage({ content: "Done!" });
    }
  }
});

async function loopCreatePosts() {
  const subreddits = config.subreddits;

  for (const subreddit in subreddits) {
    await createPosts(subreddit, subreddits[subreddit]);
  }
}

function formatNum(number) {
  const suffixes = ["", "k", "m", "b", "t"];
  const suffixStep = 3; // Group numbers by 3 digits (thousands)

  if (isNaN(number) || number === 0) {
    return "0";
  }
  if (number < 1000) return number;

  const absoluteNumber = Math.abs(number);
  const logValue = Math.floor(Math.log10(absoluteNumber) / suffixStep);
  const suffixIndex = Math.min(logValue, suffixes.length - 1);
  const formattedNumber = (
    number / Math.pow(10, logValue * suffixStep)
  ).toFixed(1);

  return formattedNumber + suffixes[suffixIndex];
}

async function fetchImageBuffer(imageUrl) {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok)
      throw new Error(
        `Failed to fetch the image: ${response.status} ${response.statusText}`
      );

    const buffer = await response.arrayBuffer();

    return Buffer.from(buffer);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function nameGen() {
  const number = Math.floor(Math.random() * 9999999999) + 1;

  return `${number + ".png"}`;
}

async function createPosts(subreddit, channelID) {
  if (alreadyWorking === true)
    return console.log('"alreadyWorking" was set to "true", igoring task.');

  const query = `${config.custom.guildID}-${subreddit}`;
  var dbData = await db.get(query);

  const channel = await client.getChannel(channelID);

  if (!dbData) {
    await db.set(query + ".posts", []);
  }

  var dbData = await db.get(query);

  console.log(subreddit + ": ");
  console.log(dbData);

  alreadyWorking = true;

  const data = await r.getSubreddit(subreddit).getTop({
    time: config.custom.topTime,
    limit: Number(config.custom.postMax),
  });

  for (let i = 0; i < data.length; i++) {
    if (i === data.length - 1) {
      alreadyWorking = false;
    }

    if (dbData.posts.includes(data[i].id)) continue;

    if (config.custom.allowNsfw == false && data[i].over_18) continue;

    const OP = data[i].author.name;

    const raw_desc = data[i].selftext;
    const postDescription =
      raw_desc.length >= 1700 ? raw_desc.slice(0, 1700) + "..." : raw_desc;

    if (
      data[i].is_video ||
      (data[i].crosspost_parent_list &&
        data[i].crosspost_parent_list[0]?.is_video)
    ) {
      const permPostLink = `https://reddit.com${data[i].permalink}`;
      const permOP = `https://reddit.com/u/${OP}`;

      message = config.custom.customMessage
        .replace(/{{postTitle}}/g, data[i].title)
        .replace(
          /\n\n### {{postDescription}}/g,
          postDescription === "" ? config.custom.defaultNoDesc : postDescription
        )
        .replace(/{{upvotes}}/g, formatNum(data[i].ups))
        .replace(/{{OP}}/g, OP)
        .replace(/{{linkToOP}}/g, permOP)
        .replace(/{{permPostLink}}/g, permPostLink);

      if (data[i].crosspost_parent_list) {
        message += ` \`|\` [Video](${data[i].crosspost_parent_list[0].secure_media?.reddit_video?.fallback_url})`;
      } else {
        message += ` \`|\` [Video](${data[i].secure_media?.reddit_video?.fallback_url})`;
      }

      await channel.createMessage({ content: message });

      console.log(
        `Posted: ${data[i].title} | ${data[i].subreddit_name_prefixed}`
      );

      await db.push(query + ".posts", data[i].id);
    } else {
      let mappedFiles = [];

      const images = data[i].preview?.images;

      if (images) {
        for (let J = 0; J < images.length; J++) {
          const res = await fetchImageBuffer(images[J].source.url);

          mappedFiles.push({ name: "image.png", contents: res });
        }
      } else if (data[i].media_metadata) {
        const media = data[i].media_metadata;

        const promises = Object.entries(media).map(async ([_id, imageData]) => {
          // s = highest quality
          // screw you reddit for calling everything so short

          const res = await fetchImageBuffer(imageData.s.u);

          return { name: "image.png", contents: res };
        });

        mappedFiles = await Promise.all(promises);
      }

      const permPostLink = `https://reddit.com${data[i].permalink}`;
      const permOP = `https://reddit.com/u/${OP}`;

      message = config.custom.customMessage
        .replace(/{{postTitle}}/g, data[i].title)
        .replace(
          /\n\n### {{postDescription}}/g,
          postDescription === ""
            ? config.custom.defaultNoDesc
            : `\n\n` + postDescription
        )
        .replace(/{{upvotes}}/g, formatNum(data[i].ups))
        .replace(/{{OP}}/g, OP)
        .replace(/{{linkToOP}}/g, permOP)
        .replace(/{{permPostLink}}/g, permPostLink);

      files = mappedFiles.slice(0, 10);

      const attachments = [];

      for (const file of files) {
        attachments.push(file.contents);
      }

      await channel.createMessage({
        content: message,
        files: attachments.map((attachment) => ({
          name: nameGen(),
          contents: attachment,
        })),
      });

      console.log(
        `Posted: ${data[i].title} | ${data[i].subreddit_name_prefixed}`
      );

      await db.push(query + ".posts", data[i].id);
    }
  }
}

client.connect();

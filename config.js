require("dotenv").config();

/* when using .env remove everything from the string
 for example, token: "" || process.env.discord_token instead of token: "Bot [REPLACE_ME]" || process.env.discord_token,
 */

module.exports = {
  reddit: {
    clientID: "[REPLACE_ME]" || process.env.reddit_client_id,
    clientSecret: "[REPLACE_ME]" || process.env.reddit_client_secret,
    username: "[REPLACE_ME]" || process.env.reddit_username,
    password: "[REPLACE_ME]" || process.env.reddit_password,
  },

  token: "Bot [REPLACE_ME]" || process.env.discord_token,

  subreddits: {
    "[subreddit]": "[channelID]",
    /*
    memes: "849913641955622912",
    aww: "849967687390986240",
    */
  },

  custom: {
    //DO NOT TOUCH customMessage or DefaultNoDesc ///
    // i am too lazy to move it to index.js
    //prettier-ignore
    customMessage:
      "`------------`\n## {{postTitle}}\n\n### {{postDescription}} \n\n`🔼` {{upvotes}} `|` [u/{{OP}}](<{{linkToOP}}>) `|` [Post](<{{permPostLink}}>)", //dont touch it
    defaultNoDesc: "", // don't touch it
    allowNsfw: "true" || process.env.custom_allow_nsfw,
    guildID: "[REPLACE_ME]" || process.env.custom_guild_id,
    postMax: "20" || process.env.custom_post_max,
    topTime: "day" || process.env.top_time, //hour, day, week, month, year, all
  },
};

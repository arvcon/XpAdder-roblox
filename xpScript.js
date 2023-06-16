const { Client, MessageEmbed, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const moment = require('moment');
const fs = require('fs');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});
const http = require('http');

async function isUserInGroup(robloxUsername) {
  try {
    const response = await axios.get(`https://api.roblox.com/users/get-by-username?username=${robloxUsername}`);
    const { Id: robloxUserId } = response.data;

    const groupResponse = await axios.get(`https://groups.roblox.com/v1/groups/${robloxGroupId}/users/${robloxUserId}`);
    const { userMembershipType } = groupResponse.data;

    return userMembershipType !== 'None';
  } catch (error) {
    console.error('Error checking membership:', error);
    return false;
  }
}

http.createServer(function (req, res) {
  res.write('ArvTec Hosting');
  res.end();
}).listen(8080);

const filePath = './xpData.json';
const robloxGroupId = 'YOUR_ROBLOX_GROUP_ID';
const robloxApiKey = 'YOUR_ROBLOX_API_KEY';

function loadXPData() {
  try {
    const data = fs.readFileSync(filePath);
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading XP data:', error);
  }
  return {};
}

function saveXPData(xpData) {
  try {
    const data = JSON.stringify(xpData);
    fs.writeFileSync(filePath, data);
  } catch (error) {
    console.error('Error saving XP data:', error);
  }
}

function getUserXP(userId) {
  const xpData = loadXPData();
  return xpData[userId]?.xp || 0;
}

function updateUserXP(userId, xpToAdd) {
  const xpData = loadXPData();
  const userXP = xpData[userId]?.xp || 0;
  const updatedXP = userXP + xpToAdd;
  xpData[userId] = { xp: updatedXP, lastUpdate: moment().toISOString() };
  saveXPData(xpData);
  return updatedXP;
}

async function updateRobloxGroupRank(userId) {
  try {
    const xpData = loadXPData();
    const userXP = xpData[userId]?.xp || 0;
-- update and change rank settings if you wish
    let newRank;
    if (userXP >= 90) {
      newRank = 5;
    } else if (userXP >= 70) {
      newRank = 4;
    } else if (userXP >= 45) {
      newRank = 3;
    } else if (userXP >= 25) {
      newRank = 2;
    } else {
      newRank = 1;
    }

    const response = await axios.patch(
      `https://groups.roblox.com/v1/groups/${robloxGroupId}/users/${xpData[userId].robloxUserId}`,
      {
        role: newRank,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${robloxApiKey}`,
        },
      }
    );

    if (response.status === 200) {
      console.log(`Updated rank for user ${userId} in Roblox group`);
    } else {
      console.error(`Error updating rank for user ${userId} in Roblox group. Response:`, response.data);
    }
  } catch (error) {
    console.error('Error updating rank in Roblox group:', error);
  }
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'addxp') {
    if (!message.member.roles.cache.some((role) => role.name === 'admin')) {
      const embed = {
        color: '16766720',
        description: 'You do not have the required role to use this command.',
      };
      message.channel.send({ embeds: [embed] });
      return;
    }

    const xpToAdd = parseInt(args[0], 10);
    const robloxUsername = args[1];
    if (!robloxUsername) {
      const embed = {
        color: '16766720',
        description: 'Please provide a Roblox username to add XP.',
      };
      message.channel.send({ embeds: [embed] });
      return;
    }

    if (isNaN(xpToAdd)) {
      const embed = {
        color: '16766720',
        description: 'Invalid XP value. Please provide a number.',
      };
      message.channel.send({ embeds: [embed] });
      return;
    }

    try {
      const isMember = await isUserInGroup(robloxUsername);
      if (!isMember) {
        const embed = {
          color: '16766720',
          description: 'The specified user is not a member of the Roblox group.',
        };
        message.channel.send({ embeds: [embed] });
        return;
      }

      try {
        const updatedXP = updateUserXP(robloxUsername, xpToAdd);
        await updateRobloxGroupRank(robloxUsername);

        const embed = {
          color: '16766720',
          title: 'XP Added',
          description: `Added ${xpToAdd} XP to ${robloxUsername}.`,
          fields: [
            { name: 'Previous XP', value: updatedXP - xpToAdd, inline: true },
            { name: 'New XP', value: updatedXP, inline: true },
          ],
          timestamp: new Date(),
          footer: { text: 'ArvTech' },
        };

        message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error adding XP:', error);
        const embed = {
          color: '16766720',
          description: 'An error occurred while adding XP.',
        };
        message.channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error checking membership:', error);
      const embed = {
        color: '16766720',
        description: 'An error occurred while checking membership.',
      };
      message.channel.send({ embeds: [embed] });
    }
  } else if (command === 'rank') {
    const targetUser = args[0] || message.author;
    try {
      const isMember = await isUserInGroup(targetUser);
      if (!isMember) {
        const embed = {
          color: '16766720',
          description: 'The specified user is not a member of the Roblox group.',
        };
        message.channel.send({ embeds: [embed] });
        return;
      }

      try {
        const groupResponse = await axios.get(
          `https://groups.roblox.com/v1/groups/${robloxGroupId}/users/${targetUser.id}`
        );
        const userData = groupResponse.data;

        const embed = {
          color: '16766720',
          title: `${targetUser.username}'s Rank`,
          description: `Rank: ${userData.role.rank}\nCurrent XP: ${getUserXP(targetUser.id)}`,
          timestamp: new Date(),
          footer: { text: 'ArvTech' },
        };

        message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error retrieving rank:', error);
        const embed = {
          color: '16766720',
          description: 'An error occurred while retrieving the rank.',
        };
        message.channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error checking membership:', error);
      const embed = {
        color: '16766720',
        description: 'An error occurred while checking membership.',
      };
      message.channel.send({ embeds: [embed] });
    }
  } else if (command === 'leaderboard') {
    const xpData = loadXPData();
    const sortedUsers = Object.entries(xpData).sort((a, b) => b[1].xp - a[1].xp);

    const embed = {
      color: '16766720',
      title: 'XP Leaderboard',
      description: 'Top 10 Users',
      timestamp: new Date(),
      footer: { text: 'ArvTech' },
      fields: [],
    };

    for (let i = 0; i < Math.min(sortedUsers.length, 10); i++) {
      const userId = sortedUsers[i][0];
      const xp = sortedUsers[i][1].xp;
      const user = await client.users.fetch(userId);
      embed.fields.push({ name: `${i + 1}. ${user.username}`, value: `XP: ${xp}`, inline: true });
    }

    message.channel.send({ embeds: [embed] });
  } else if (command === 'help') {
    const embed = {
      color: '16766720',
      title: 'Help',
      description: 'I am ArcBot. Here is the guide',
      fields: [
        { name: '!addxp', value: 'Adds XP to a user, admin only! Usage: !addxp <XP> <RobloxUsername>', inline: true },
        { name: '!rank', value: 'Shows the rank and XP of a user. Usage: !rank [RobloxUsername]', inline: true },
        { name: '!leaderboard', value: 'Shows the XP leaderboard', inline: true },
        { name: 'Need more help?', value: 'DM ArvTech for assistance', inline: true },
      ],
      timestamp: new Date(),
      footer: { text: 'ArvTech' },
    };
    message.channel.send({ embeds: [embed] });
  }
});

client.login('YOUR_OWN_BOT_TOKEN');

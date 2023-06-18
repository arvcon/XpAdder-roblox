const { Client, MessageEmbed, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const moment = require('moment');
const fs = require('fs');
const {execSync} = require('child_process');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const http = require('http');
let isLockedDown = false;

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
function lockdown(message, ownerId) {
  if (message.author.id !== ownerId) {
    const embed = {
      color: '16766720',
      description: 'You do not have permission to use this command.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  isLockedDown = true;

  const guild = client.guilds.cache.get('YOUR_SERVER_ID');
  const roles = guild.roles.cache;
  const adminRole = roles.find((role) => role.name === 'admin');

  guild.members.cache.forEach((member) => {
    if (member.roles.cache.has(adminRole.id) && member.id !== ownerId) {
      member.roles.remove(adminRole);
    }
  });

  const embed = {
    color: '16766720',
    description: 'Bot is now in lockdown mode. Only the owner can use the bot.',
  };
  message.channel.send({ embeds: [embed] });
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

function getUserXP(robloxUserId) {
  const xpData = loadXPData();
  return xpData[robloxUserId]?.xp || 0;
}

function updateUserXP(robloxUserId, xpToAdd, robloxUsername) {
  const xpData = loadXPData();
  const userXP = xpData[robloxUserId]?.xp || 0;
  const updatedXP = userXP + xpToAdd;
  xpData[robloxUserId] = { xp: updatedXP, lastUpdate: moment().toISOString(), robloxUsername };
  saveXPData(xpData);
  return updatedXP;
}

async function updateRobloxGroupRank(robloxUserId) {
  try {
    const xpData = loadXPData();
    const userXP = xpData[robloxUserId]?.xp || 0;

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
      `https://groups.roblox.com/v1/groups/${robloxGroupId}/users/${robloxUserId}`,
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
      console.log(`Updated rank for user ${robloxUserId} in Roblox group`);
    } else {
      console.error(`Error updating rank for user ${robloxUserId} in Roblox group. Response:`, response.data);
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
   
  if (command === 'lockdown') {
    lockdown(message, 'YOUR_DISCORD_ACCOUNT_ID');
  } else if (isLockedDown) {
    const embed = {
      color: '16766720',
      description: 'Bot in lockdown mode, try again later.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  } else if (command === 'addxp') {
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
        const response = await axios.get(`https://api.roblox.com/users/get-by-username?username=${robloxUsername}`);
        const { Id: robloxUserId } = response.data;
        const updatedXP = updateUserXP(robloxUserId, xpToAdd, robloxUsername);
        await updateRobloxGroupRank(robloxUserId);

        // Save the XP data after updating
        saveXPData(loadXPData());

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
      const response = await axios.get(`https://api.roblox.com/users/get-by-username?username=${targetUser}`);
      const { Id: robloxUserId } = response.data;
      const isMember = await isUserInGroup(robloxUserId);
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
          `https://groups.roblox.com/v1/groups/${robloxGroupId}/users/${robloxUserId}`
        );
        const userData = groupResponse.data;

        const embed = {
          color: '16766720',
          title: `${targetUser}'s Rank`,
          description: `Rank: ${userData.role.rank}\nCurrent XP: ${getUserXP(robloxUserId)}`,
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
  } else if (command === 'kick') {
  if (!message.member.roles.cache.some((role) => role.name === 'admin')) {
    const embed = {
      color: '16766720',
      description: 'You do not have the required role to use this command.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    const embed = {
      color: '16766720',
      description: 'Please mention a user to kick.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  const member = message.guild.members.cache.get(targetUser.id);
  if (!member) {
    const embed = {
      color: '16766720',
      description: 'The mentioned user is not a member of this server.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  member.kick()
    .then(() => {
      const embed = {
        color: '16766720',
        description: `Successfully kicked ${targetUser.tag}.`,
      };
      message.channel.send({ embeds: [embed] });
    })
    .catch((error) => {
      console.error('Error kicking user:', error);
      const embed = {
        color: '16766720',
        description: 'An error occurred while kicking the user.',
      };
      message.channel.send({ embeds: [embed] });
    });
} else if (command === 'ban') {
  if (!message.member.roles.cache.some((role) => role.name === 'admin')) {
    const embed = {
      color: '16766720',
      description: 'You do not have the required role to use this command.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    const embed = {
      color: '16766720',
      description: 'Please mention a user to ban.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  const member = message.guild.members.cache.get(targetUser.id);
  if (!member) {
    const embed = {
      color: '16766720',
      description: 'The mentioned user is not a member of this server.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  member.ban()
    .then(() => {
      const embed = {
        color: '16766720',
        description: `Successfully banned ${targetUser.tag}.`,
      };
      message.channel.send({ embeds: [embed] });
    })
    .catch((error) => {
      console.error('Error banning user:', error);
      const embed = {
        color: '16766720',
        description: 'An error occurred while banning the user.',
      };
      message.channel.send({ embeds: [embed] });
    });
} else if (command === 'purge') {
  if (!message.member.roles.cache.some((role) => role.name === 'admin')) {
    const embed = {
      color: '16766720',
      description: 'You do not have the required role to use this command.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  const deleteCount = parseInt(args[0], 10);

  if (isNaN(deleteCount) || deleteCount < 1 || deleteCount > 100) {
    const embed = {
      color: '16766720',
      description: 'Please provide a number between 1 and 100 for the number of messages to delete.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  message.channel.bulkDelete(deleteCount)
    .then(() => {
      const embed = {
        color: '16766720',
        description: `Successfully deleted ${deleteCount} messages.`,
      };
      message.channel.send({ embeds: [embed] });
    })
    .catch((error) => {
      console.error('Error deleting messages:', error);
      const embed = {
        color: '16766720',
        description: 'An error occurred while deleting messages.',
      };
      message.channel.send({ embeds: [embed] });
    });
} else if (command === 'mute') {
  if (!message.member.roles.cache.some((role) => role.name === 'admin')) {
    const embed = {
      color: '16766720',
      description: 'You do not have the required role to use this command.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    const embed = {
      color: '16766720',
      description: 'Please mention a user to mute.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  const member = message.guild.members.cache.get(targetUser.id);
  if (!member) {
    const embed = {
      color: '16766720',
      description: 'The mentioned user is not a member of this server.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  const muteRole = message.guild.roles.cache.find((role) => role.name === 'Muted');
  if (!muteRole) {
    const embed = {
      color: '16766720',
      description: 'The mute role does not exist. Please create a role named "Muted".',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  if (member.roles.cache.has(muteRole.id)) {
    member.roles.remove(muteRole)
      .then(() => {
        const embed = {
          color: '16766720',
          description: `Successfully unmuted ${targetUser.tag}.`,
        };
        message.channel.send({ embeds: [embed] });
      })
      .catch((error) => {
        console.error('Error unmuting user:', error);
        const embed = {
          color: '16766720',
          description: 'An error occurred while unmuting the user.',
        };
        message.channel.send({ embeds: [embed] });
      });
  } else {
    member.roles.add(muteRole)
      .then(() => {
        const embed = {
          color: '16766720',
          description: `Successfully muted ${targetUser.tag}.`,
        };
        message.channel.send({ embeds: [embed] });
      })
      .catch((error) => {
        console.error('Error muting user:', error);
        const embed = {
          color: '16766720',
          description: 'An error occurred while muting the user.',
        };
        message.channel.send({ embeds: [embed] });
      });
  }
} else if (command === 'remove') {
  if (!message.member.roles.cache.some((role) => role.name === 'admin')) {
    const embed = {
      color: '16766720',
      description: 'You do not have the required role to use this command.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  const robloxUsername = args[0];
  if (!robloxUsername) {
    const embed = {
      color: '16766720',
      description: 'Please provide a Roblox username to kick from the group.',
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  try {
    const response = await axios.get(`https://api.roblox.com/users/get-by-username?username=${robloxUsername}`);
    const { Id: robloxUserId } = response.data;

    const kickResponse = await axios.delete(
      `https://groups.roblox.com/v1/groups/${robloxGroupId}/users/${robloxUserId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${robloxApiKey}`,
        },
      }
    );

    if (kickResponse.status === 200) {
      const embed = {
        color: '16766720',
        description: `Successfully kicked ${robloxUsername} from the Roblox group.`,
      };
      message.channel.send({ embeds: [embed] });
    } else {
      console.error(`Error kicking ${robloxUsername} from the Roblox group. Response:`, kickResponse.data);
      const embed = {
        color: '16766720',
        description: 'An error occurred while kicking the user from the Roblox group.',
      };
      message.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error kicking user from the Roblox group:', error);
    const embed = {
      color: '16766720',
      description: 'An error occurred while kicking the user from the Roblox group.',
    };
    message.channel.send({ embeds: [embed] });
  }
} 






});

client.login('YOUR_DISCORD_BOT_TOKEN');

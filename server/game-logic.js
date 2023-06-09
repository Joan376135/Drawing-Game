import randomWords from 'random-words';
import Players from './models/players.js';
import Game from './models/game.js';
import Chat from './models/chat.js';

export class DrawingGame {
  static async resetTurns(room) {
    await Players.findByIdAndUpdate(
      room,
      { $set: { "players.$[].artistTurn": false } },
    )
      .catch((error) => {
        console.error(error);
      });
  }
  static async resetScoreTurn(room) {
    await Players.findByIdAndUpdate(
      room,
      { $set: { "players.$[].scoreTurn": false } },
    )
      .catch((error) => {
        console.error(error);
      });
  }

  static async isNextArtist(room) {
    const isNextArtist = await Players.aggregate([
      { $match: { _id: room } },
      { $unwind: "$players" },
      { $match: { "players.artistTurn": false } },
      { $sort: { "players.createdAt": 1 } },
      { $limit: 1 },
    ]);

    return isNextArtist;
  }

  static async faseHandler({
    room, fase, turn, mainPlayerId,
  }) {
    if (fase === "select-word") {
      await DrawingGame.updateGame({
        room,
        body: {
          timeLeftMax: 20,
          timeLeftMin: 0,
        },
      });
    } else if (fase === "select-word-endfase") {
      await DrawingGame.resetScoreTurn(room);
      setTimeout(async () => {
        await DrawingGame.updateGame({
          room,
          body: {
            fase: 'guess-word',
            turnScores: 0,
          },
        });
      }, 3000);
    } else if (fase === "guess-word") {
      await DrawingGame.updateGame({
        room,
        body: {
          timeLeftMax: 20,
        },
      });
    } else if (fase === "guess-word-endfase") {
      setTimeout(async () => {
        await DrawingGame.updateChat({
          room,
          body: {
            word: null,
            fase: null,
          },
        });
        const playersModelInTheRoom = await Players.findById(room);
        const playersInTheRoom = playersModelInTheRoom.players;
        const playersWhichHasScored = playersInTheRoom.filter((obj) => obj.scoreTurn === true);
        const value = (playersWhichHasScored.length / playersInTheRoom.length * 200);
        console.log(`puntuación artista: ${value}, artitsId:${mainPlayerId}`);
        console.log('playersInTheRoom: ', playersInTheRoom, 'playersWhichHasScored: ', playersWhichHasScored);
        await Players.findByIdAndUpdate(
          room,
          { $inc: { "players.$[player].score": value } },
          { arrayFilters: [{ "player._id": mainPlayerId }] },
        ).catch((error) => {
          console.error(error);
        });
        if (turn > 7) {
          await DrawingGame.updateGame({
            room,
            body: {
              $inc: { round: 1 },
              turn: 0,
            },
          });
        } else {
          await DrawingGame.prepareNextTurn(room);
        }
      }, 3000);
    }
  }
  static async messagesHandler({
    message, nickname, playerId, word, fase, room, io,
  }) {
    if (message?.toUpperCase() === word?.toUpperCase() && fase === "guess-word") {
      let timeLeftChangeValue = 2;
      const playersModelInTheRoom = await Players.findById(room);
      const playersInTheRoom = playersModelInTheRoom.players;
      const playersWhichCanScore = playersInTheRoom.filter((obj) => obj.scoreTurn === false);
      const numberOfPlayersWhichCanScore = playersWhichCanScore.length;
      const player = playersInTheRoom.find((obj) => obj._id.toString() === playerId);
      const playerScoreTurn = player.scoreTurn;
      console.log(`playersInTheRoom: ${playersInTheRoom}, numberOfPlayersWhichCanScore:${numberOfPlayersWhichCanScore},player: ${player}`);
      if (playerScoreTurn === false) {
        if (numberOfPlayersWhichCanScore <= 2) {
          timeLeftChangeValue = 20;
        }
        const gameDataUpdated = await DrawingGame.updateGame({
          room,
          body: {
            $inc: { timeLeftMin: timeLeftChangeValue },
          },
        });
        const turnScoreInc = (gameDataUpdated.timeLeftMax / 20 * 200);
        await Players.findByIdAndUpdate(
          room,
          { $inc: { "players.$[player].score": turnScoreInc }, "players.$[player].scoreTurn": true },
          { arrayFilters: [{ "player._id": playerId }] },
        ).catch((error) => {
          console.error(error);
        });
      }
    } else {
      io.of('/table').to(room).emit('update-chat-messages', { message, nickname });
    }
  }
  static async roundHandler({ room, round }) {
    await DrawingGame.resetTurns(room);
    if (round < 3) {
      await DrawingGame.prepareNextTurn(room);
    } else {
      console.log('END OF THE GAME');
      DrawingGame.gameOff(room);
    }
  }

  static async timeLeftHandler({
    room, fase, threeWords, timeLeftMax, timeLeftMin,
  }) {
    if (timeLeftMax <= timeLeftMin) {
      if (fase === 'select-word') {
        if (threeWords !== []) {
          const finalWord = await threeWords[DrawingGame.randomNumber(3)];
          await Chat.findByIdAndUpdate(
            room,
            { word: finalWord },
          );
        }
      } else if (fase === 'guess-word') {
        await DrawingGame.updateGame({
          room,
          body: {
            fase: "guess-word-endfase",
          },
        });

        console.log('end of the turn');
      }
    } else if (timeLeftMax > timeLeftMin && (fase === "select-word" || fase === "guess-word")) {
      DrawingGame.clock(room);
    }
  }

  static async findPlayersWithScoreLefts(room) {
    const players = await Players.aggregate([
      { $match: { _id: room } },
      { $unwind: "$players" },
      { $match: { "players.scoreTurn": false } },
    ]);
    return players;
  }

  static async updateGame({ room, body }) {
    const gameUpdated = await Game.findByIdAndUpdate(
      room,
      body,
      { new: true },
    );
    return gameUpdated;
  }
  static async updateChat({ room, body }) {
    const chatUpdated = await Chat.findByIdAndUpdate(
      room,
      body,
      { new: true },
    );
    return chatUpdated;
  }

  static async prepareNextTurn(room) {
    const isNextArtist = await DrawingGame.isNextArtist(room);
    if (isNextArtist.length === 1) {
      const nextArtist = isNextArtist[0].players;
      const nextArtistId = nextArtist._id;
      console.log('nextArtist:', nextArtist);
      Players.findByIdAndUpdate(
        room,
        { $set: { "players.$[player].artistTurn": true } },
        { arrayFilters: [{ "player._id": nextArtistId }] },
      )
        .catch((error) => {
          console.error(error);
        });
      const threeWords = randomWords({
        exactly: 3,
        formatter: (word) => word.toUpperCase(),
      });
      DrawingGame.updateGame({
        room,
        body: {
          mainPlayerId: nextArtistId,
          $inc: { turn: 1 },
          threeWords,
          timeLeftMin: 0,
          fase: 'select-word',
        },
      });
      DrawingGame.updateChat({
        room,
        body: {
          fase: "select-word",
        },
      });
    } else if (isNextArtist.length === 0) {
      DrawingGame.updateGame({
        room,
        body: {
          $inc: { round: 1 },
          turn: 0,
        },
      });
    }
  }

  static async gameOn(room) {
    await DrawingGame.updateGame({
      room,
      body: { gameOn: true },
    });
  }

  static async gameOff(room) {
    DrawingGame.updateGame({
      room,
      body: { gameOn: false, round: 0 },
    });
  }

  static clock(room) {
    setTimeout(async () => {
      await DrawingGame.updateGame({
        room,
        body: { $inc: { timeLeftMax: -1 } },
      });
    }, 1500);
  }

  static randomNumber(number) {
    return Math.floor(Math.random() * number);
  }
}

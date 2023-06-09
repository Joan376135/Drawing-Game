import http from "../http-common";

export default class PintureteDataService {
    static createTable(data) {
        return http.post("/createtable", data);
    }
    static checkTable(data) {
        return http.post("/checktable", data);
    }
    static createPlayer(data) {
        return http.post("/createplayer", data);
    }
    static checkPlayers(data) {
        return http.post("/checkplayers", data);
    }
    static deletePlayer(data) {
        return http.post("/deleteplayer", data);
    }
    static gameInfo(data) {
        return http.post("/gameinfo", data);
    }
    static saveMessage(data) {
        return http.post("/savemessage", data);
    }
    static saveWord(data) {
        return http.post("/saveword", data);
    }
    static chatInfo(data) {
        return http.post("/chatinfo", data);
    }
}

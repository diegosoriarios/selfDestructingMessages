import React, { Component } from 'react'
import axios from 'axios'
import Chatkit from '@pusher/chatkit-client'

import "skeleton-css/css/normalize.css"
import "skeleton-css/css/skeleton.css"
import "./App.css"
import { timingSafeEqual } from 'crypto';

class App extends Component {
  state = {
    currentUser: null,
    currentRoom: null,
    newMessage: "",
    messages: [],
    roomUsers: [],
    messageTimer: "0"
  }

  handleInput = event => {
    const { value, name } = event.target

    this.setState({
      [name]: value
    })
  }

  addUser = event => {
    event.preventDefault()
    const { userId } = this.state
    axios
      .post("http://localhost:5200/users", { userId })
      .then(() => {
        const tokenProvider = new Chatkit.TokenProvider({
          url: "http://localhost:5200/authenticate"
        })

        const chatManager = new Chatkit.ChatManager({
          instanceLocator: "v1:us1:8ad8701b-c655-4ca8-9de7-34c360ca5600",
          userId,
          tokenProvider
        })

        return chatManager
          .connect({
            onRoomUpdated: room => {
              const { messageTimer } = room.customData
              this.setState(
                {
                  messageTimer
                },
                () => this.showStatusMessage()
              );
            }
          })
          .then(currentUser => {
            this.setState(
              {
                currentUser
              },
              () => this.connectToRoom()
            );
          })
      })
      .catch(console.error)
  }

  connectToRoom = () => {
    const { currentUser } = this.state

    return currentUser
      .subscribeToRoom({
        roomId: '20509997',
        messageLimit: 100,
        hooks: {
          onMessage: message => {
            const messages = [...this.state.messages, message]
            const index = messages.findIndex(item => item.id === message.id)
            if (index !== -1) {
              messages.splice(index, 1, message)
            } else {
              messages.push(message)
            }

            const { messageTimer } = this.state
            if(message.text !== "DELETED" && messageTimer !== "0") {
              this.deleteMessage(message.id)
            }

            this.setState({
              messages
            })
          },
          onPresenceChanged: () => {
            const { currentRoom } = this.state

            this.setState({
              roomUsers: currentRoom.users.sort(a => {
                if(a.presence.state === "online") return -1;

                return 1
              })
            });
          }
        }
      })
      .then(currentRoom => {
        this.setState({
          currentRoom,
          roomUsers: currentRoom.users
        })
      })
  }

  sendMessage = event => {
    event.preventDefault()

    const {newMessage, currentUser, currentRoom} = this.state

    if(newMessage.trim() === '') return

    currentUser.sendMessage({
      text: newMessage,
      roomId: `${currentRoom.id}`
    })

    this.setState({
      newMessage: ''
    })
  }

  updateMessageTimer = event => {
    const { value } = event.target
    const { currentRoom, currentUser } = this.state
    this.setState({
      messageTimer: value
    })

    currentUser.updateRoom({
      roomId: currentRoom.id,
      customData: { messageTimer: value }
    })
  }

  showStatusMessage = () => {
    const { messageTimer, messages } = this.state
    const text = `The disappearing message timeout has been set to ${messageTimer / 1000} seconds`

    const statusMessage = {
      id: `${Date.now() + Math.random()}`,
      text,
      type: 'status'
    }
    messages.push(statusMessage)

    this.setState({
      messages
    })
  }

  deleteMessage = id => {
    const { messageTimer } = this.state
    axios
      .post('http://localhost:5200/delete-message', {
        messageId: id,
        timer: Number(messageTimer),
      })
      .catch(console.error)
  }

  render() {
    const {
      newMessage,
      roomUsers,
      currentRoom,
      messages,
      currentUser,
      messageTimer
    } = this.state

    const UserList = roomUsers.map(user => {
      return (
        <li className="user" key={user}>
          <span className={`presence ${user.presence.state}`} />
          <span>{user.name}</span>
        </li>
      );
    })

    const ChatSession = messages.map(message => {
      return message.type ? (
        <li className="status-message" key={message.id}>
          <span>{message.text}</span>
        </li>
      ) : (
        <li className="message" key={message.id}>
          <span className="user-id">{message.senderId}</span>
          <span>{message.text}</span>
        </li>
      );
    })

    return (
      <div className="App">
        <aside className="sidebar left-sidebar">
          {!currentUser ? (
            <section className="join-chat">
              <h3>Join Chat</h3>
              <form onSubmit={this.addUser}>
                <input
                  placeholder="Enter your username"
                  type="text"
                  name="userId"
                  onChange={this.handleInput}
                />
              </form>
            </section>
          ) : null}

          {currentUser ? (
            <section className="room-users">
              <h3>Room Users</h3>
              <ul>{UserList}</ul>
            </section>
          ) : null}
        </aside>

        <section className="chat-window">
            <header className="room-name">
              <h3>{currentRoom ? currentRoom.name : "Chat"}</h3>
            </header>
            <ul className="chat-session">{ChatSession}</ul>
            <form onSubmit={this.sendMessage} className="message-form">
              <input
                className="message-input"
                autoFocus
                placeholder="Compose your message and hit ENTER to send"
                onChange={this.handleInput}
                value={newMessage}
                name="newMessage"
              />
            </form>
        </section>

        <aside className="sidebar right-sidebar">
            {currentUser ? (
              <section className="preferences">
                <h3>Disappearing Messages</h3>
                <select
                  id="timeout"
                  name="timeout"
                  value={messageTimer}
                  onChange={this.updateMessageTimer}
                >
                  <option value="0">Off</option>
                  <option value="10000">10 seconds</option>
                  <option value="20000">20 seconds</option>
                  <option value="30000">30 seconds</option>
                  <option value="60000">1 minute</option>
                </select>
              </section>
            ) : null}
        </aside>
      </div>
    );
  }
}

export default App;
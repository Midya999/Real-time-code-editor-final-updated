import "./App.css";
import io from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { v4 as uuidv4 } from "uuid";

const socket = io(
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : window.location.origin
);

const App = () => {

  const editorRef = useRef(null);

  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start coding...");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [userInput, setUserInput] = useState("");

  useEffect(() => {

    socket.on("userJoined", setUsers);

    socket.on("codeUpdate", setCode);

    socket.on("usertyping", (user) => {
      setTyping(`${user} is typing`);
      setTimeout(() => setTyping(""), 2000);
    });

    socket.on("languageUpdated", (lang) => {

      setLanguage(lang);

      if (editorRef.current) {

        const model = editorRef.current.getModel();

        if (model) {
          window.monaco.editor.setModelLanguage(model, lang);
        }

      }

    });

    socket.on("codeResponse", (res) => {
      setOutput(res.run.output);
      setRunning(false);
    });

  }, []);

  const joinRoom = () => {

    if (roomId && userName) {

      socket.emit("join", {
        roomId,
        username: userName
      });

      setJoined(true);

    }

  };

  const leaveRoom = () => {

    socket.emit("leaveRoom");

    setJoined(false);

    setCode("// Start coding...");

    setLanguage("javascript");

  };

  const handleCodeChange = (value) => {

    if (!value) return;

    setCode(value);

    socket.emit("codeChange", {
      roomId,
      code: value
    });

    socket.emit("typing", {
      roomId,
      username: userName
    });

  };

  const handleLanguageChange = (e) => {

    const newLang = e.target.value;

    setLanguage(newLang);

    socket.emit("languageChange", {
      roomId,
      language: newLang
    });

  };

  const runCode = () => {

    setRunning(true);

    setOutput("Running code...");

    socket.emit("compileCode", {
      code,
      roomId,
      language,
      input: userInput
    });

  };

  const createRoomId = () => {
    setRoomId(uuidv4());
  };

  if (!joined) {

    return (

      <div className="join-container">

        <h1>Join Code Room</h1>

        <input
          placeholder="Room Id"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />

        <button onClick={createRoomId}>Create Room</button>

        <input
          placeholder="Your Name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
        />

        <button onClick={joinRoom}>Join</button>

      </div>

    );

  }

  return (

    <div className="editor-container">

      <div className="sidebar">

        <h3>Code Room: {roomId}</h3>

        <h4>Users</h4>

        <ul>
          {users.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>

        <p>{typing}</p>

        <select value={language} onChange={handleLanguageChange}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>

        <button onClick={leaveRoom}>Leave Room</button>

      </div>

      <div className="editor-wrapper">

        <Editor
          height="60%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          onMount={(editor) => editorRef.current = editor}
        />

        <textarea
          placeholder="Enter input..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />

        <button onClick={runCode} disabled={running}>
          {running ? "Running..." : "Execute"}
        </button>

        <textarea value={output} readOnly />

      </div>

    </div>

  );

};

export default App;

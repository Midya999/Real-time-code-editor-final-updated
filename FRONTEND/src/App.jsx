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

socket.on("connect", () => {
  console.log("connected to server", socket.id);
});

const App = () => {

  const editorRef = useRef(null);

  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start coding...");
  const [copySuccess, setCopySuccess] = useState("");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [output, setOutput] = useState("");
  const [version, setVersion] = useState("*");
  const [running, setRunning] = useState(false);
  const [userInput, setUserInput] = useState("");

  useEffect(() => {

    socket.on("userJoined", (users) => {
      setUsers(users);
    });

    socket.on("codeUpdate", (newCode) => {

  if (editorRef.current) {

    const model = editorRef.current.getModel();

    if (model && model.getValue() !== newCode) {

      const position = editorRef.current.getPosition(); // save cursor

      model.setValue(newCode);

      editorRef.current.setPosition(position); // restore cursor
    }

  }

  setCode(newCode);

});
});
    socket.on("usertyping", (user) => {
      setTyping(`${user.slice(0, 8)}...is typing`);
      setTimeout(() => setTyping(""), 2000);
    });

    socket.on("languageUpdated", (newLanguage) => {
      setLanguage(newLanguage);

      if (editorRef.current) {
        const model = editorRef.current.getModel();
        window.monaco.editor.setModelLanguage(model, newLanguage);
      }
    });

    socket.on("codeResponse", (response) => {
      setOutput(response.run.output);
      setRunning(false);
    });

    return () => {
      socket.off("userJoined");
      socket.off("codeUpdate");
      socket.off("usertyping");
      socket.off("languageUpdated");
      socket.off("codeResponse");
    };

  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit("leaveRoom");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };

  }, []);

  const joinRoom = () => {
    if (roomId && userName) {
      socket.emit("join", { roomId, username: userName });
      setJoined(true);
    }
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("// Start coding...");
    setLanguage("javascript");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("copied to clipboard!");

    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
  if (!newCode) return;   // important fix

  setCode(newCode);

  socket.emit("codeChange", {
    roomId,
    code: newCode
  });

  socket.emit("typing", {
    roomId,
    username: userName
  });
};
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;

    setLanguage(newLanguage);

    socket.emit("languageChange", {
      roomId,
      language: newLanguage
    });

    if (editorRef.current) {
      const model = editorRef.current.getModel();
      window.monaco.editor.setModelLanguage(model, newLanguage);
    }
  };

  const runCode = () => {

    setRunning(true);
    setOutput("Running code...");

    socket.emit("compileCode", {
      code,
      roomId,
      language,
      version,
      input: userInput
    });

  };

  const createRoomId = () => {
    const newRoomId = uuidv4();
    setRoomId(newRoomId);
  };

  if (!joined) {
    return (
      <div className="join-container">

        <div className="join-form">

          <h1>Join Code Room</h1>

          <input
            type="text"
            placeholder="Room Id"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />

          <button onClick={createRoomId}>Create Id</button>

          <input
            type="text"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />

          <button onClick={joinRoom}>Join Room</button>

        </div>

      </div>
    );
  }

  return (

    <div className="editor-container">

      <div className="sidebar">

        <div className="room-info">
          <h2>Code Room: {roomId}</h2>

          <button onClick={copyRoomId} className="copy-button">
            Copy Id
          </button>

          {copySuccess && (
            <span className="copy-success">{copySuccess}</span>
          )}

        </div>

        <h3>Users in Room:</h3>

        <ul>
          {users.map((user, index) => (
            <li key={index}>{user}</li>
          ))}
        </ul>

        <p className="typing-indicator">{typing}</p>

        <select
          className="language-selector"
          value={language}
          onChange={handleLanguageChange}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>

        <button className="leave-button" onClick={leaveRoom}>
          Leave Room
        </button>

      </div>

      <div className="editor-wrapper">

        <Editor
          height={"60%"}
          defaultLanguage={language}
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          onMount={(editor) => {
            editorRef.current = editor;
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
          }}
        />

        <textarea
          className="input-console"
          placeholder="Enter input for your code here..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />

        <button
          className="run-btn"
          onClick={runCode}
          disabled={running}
        >
          {running ? "Running..." : "Execute"}
        </button>

        <textarea
          className="output-console"
          value={output}
          readOnly
          placeholder="Output will appear here..."
        />

      </div>

    </div>
  );
};

export default App;

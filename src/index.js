const express = require("express");
const cors = require("cors");

const { v4: uuidv4, validate } = require("uuid");

const app = express();
app.use(express.json());
app.use(cors());

const users = [];

const getUserByUsername = (username) => {
  const user = users.find((item) => item.username === username);
  if (user) {
    return user;
  }
  return null;
};

const isValidUuid = (uuid) => {
  return typeof uuid === "string" && validate(uuid);
};

const getTodosByUserId = (userId) => {
  const user = users.find((user) => user.id === userId);
  if (!user) {
    return [];
  }
  return user.todos;
};

const canRegisterTodo = (user) => {
  if (user.pro || user.todos.length < 10) {
    return true;
  }
  return false;
};

const getTodoUserByTodoId = (userId, todoId) => {
  const todos = getTodosByUserId(userId);
  const todo = todos.find((todo) => todo.id === todoId);
  return todo ? todo : null;
};

// Middlewares
const checksExistsUserAccount = (req, res, next) => {
  const { username } = req.headers;
  const user = getUserByUsername(username);
  if (!user) {
    return res.status(404).json({ error: "username not found." });
  }
  req.user = user;
  return next();
};

const checksCreateTodosUserAvailability = (req, res, next) => {
  const { user } = req;
  if (!canRegisterTodo(user)) {
    return res.status(403).json({
      error: "Active pro mode for register more than 10 todos.",
    });
  }
  return next();
};

const checksTodoExists = (req, res, next) => {
  const { username } = req.headers;
  let user = req.user;

  if (!user) {
    user = getUserByUsername(username);
  }

  if (!user) {
    return res.status(404).json({ error: "username not found." });
  }

  const { id } = req.params;
  if (!isValidUuid(id)) {
    return res.status(400).json({ error: "invalid user." });
  }

  const todo = getTodoUserByTodoId(user.id, id);
  if (!todo) {
    return res.status(404).json({ error: "todo not found." });
  }

  req.user = user;
  req.todo = todo;
  return next();
};

const findUserById = (req, res, next) => {
  const { id } = req.params;
  const user = users.find((item) => item.id === id);
  if (!user) {
    return res.status(404).json({ error: "user not found." });
  }
  req.user = user;
  return next();
};

app.post("/users", (req, response) => {
  const { name, username } = req.body;

  const usernameAlreadyExists = users.some(
    (user) => user.username === username
  );

  if (usernameAlreadyExists) {
    return response.status(400).json({ error: "Username already exists" });
  }

  const user = {
    id: uuidv4(),
    name,
    username,
    pro: false,
    todos: [],
  };

  users.push(user);

  return response.status(201).json(user);
});

app.get("/users/:id", findUserById, (req, res) => {
  const { user } = req;

  return res.json(user);
});

app.patch("/users/:id/pro", findUserById, (req, res) => {
  const { user } = req;

  if (user.pro) {
    return res.status(400).json({ error: "Pro plan is already activated." });
  }

  user.pro = true;

  return res.json(user);
});

app.get("/todos", checksExistsUserAccount, (req, res) => {
  const { user } = req;

  return res.json(user.todos);
});

app.post(
  "/todos",
  checksExistsUserAccount,
  checksCreateTodosUserAvailability,
  (req, res) => {
    const { title, deadline } = req.body;
    const { user } = req;

    const newTodo = {
      id: uuidv4(),
      title,
      deadline: new Date(deadline),
      done: false,
      created_at: new Date(),
    };

    user.todos.push(newTodo);

    return res.status(201).json(newTodo);
  }
);

app.put("/todos/:id", checksTodoExists, (req, res) => {
  const { title, deadline } = req.body;
  const { todo } = req;

  todo.title = title;
  todo.deadline = new Date(deadline);

  return res.json(todo);
});

app.patch("/todos/:id/done", checksTodoExists, (req, res) => {
  const { todo } = req;

  todo.done = true;

  return res.json(todo);
});

app.delete(
  "/todos/:id",
  checksExistsUserAccount,
  checksTodoExists,
  (req, res) => {
    const { user, todo } = req;

    const todoIndex = user.todos.indexOf(todo);

    if (todoIndex === -1) {
      return res.status(404).json({ error: "Todo not found" });
    }

    user.todos.splice(todoIndex, 1);

    return res.status(204).send();
  }
);

module.exports = {
  app,
  users,
  checksExistsUserAccount,
  checksCreateTodosUserAvailability,
  checksTodoExists,
  findUserById,
};

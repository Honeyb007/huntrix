const express = require('express');
const cors = require('cors');
const fs = require('fs');          // ✅ ADD THIS BACK
const path = require('path');      // ✅ ADD THIS BACK

const app = express();

app.use(cors());
app.use(express.static('public'));
app.use(express.json());
// Register endpoint
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    const filePath = path.join(__dirname, 'users.json');
    const users = JSON.parse(fs.readFileSync(filePath));

    const userExists = users.find(u => u.username === username);
    if (userExists) {
        return res.status(400).json({ message: "Username already exists" });
    }

    const newUser = { username, password, character: null };
    users.push(newUser);

    fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
    res.json({ message: "User registered successfully" });
});

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const filePath = path.join(__dirname, 'users.json');
    const users = JSON.parse(fs.readFileSync(filePath));

    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
    }

    res.json({ message: "Login successful", user });
});
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
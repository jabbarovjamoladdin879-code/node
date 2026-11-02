const http = require('http');
const bcrypt = require('bcrypt');
const { read_file, write_file } = require('./file-system/file-sys');

const send = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

// Body ni to'liq yig'ib, JSON ga o'giradi
const get_body = (req, callback) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    try {
      callback(null, body ? JSON.parse(body) : {});
    } catch (error) {
      callback(error);
    }
  });
};

// Javobda parol ko'rinmasligi uchun
const hide = (item) => {
  const { password, ...rest } = item;
  return rest;
};

// Body da parol bo'lsa bcrypt bilan hash qiladi
const hash_body = async (bodyData) => {
  if (typeof bodyData.password === 'string') {
    bodyData.password = await bcrypt.hash(bodyData.password, 10);
  }
  return bodyData;
};

const next_id = (fileData) => {
  return fileData.length ? Math.max(...fileData.map((item) => item.id || 0)) + 1 : 1;
};

// Har bir resurs uchun: [birlik nomi, ko'plik nomi]
const resources = [
  ['post', 'posts'],
  ['car', 'cars'],
  ['student', 'students'],
  ['teacher', 'teachers'],
  ['product', 'products'],
  ['fruit', 'fruits'],
  ['flower', 'flowers'],
  ['user', 'users'],
  ['book', 'books'],
];

const app = http.createServer((req, res) => {
  // Postman query params (?x=1) route ni buzmasligi uchun
  req.url = req.url.split("?")[0];

  const parts = req.url.split("/").filter(Boolean);
  const url_action = parts[0];
  const url_id = parts[1] !== undefined ? Number(parts[1]) : null;

  // LOGIN (bcrypt.compare)
  if (req.method === "POST" && req.url === "/login") {
    return get_body(req, async (error, bodyData) => {
      if (error) return send(res, 400, { message: "invalid json" })

      const user = read_file("users.json").find((el) => el.email === bodyData.email)

      if (!user || typeof bodyData.password !== 'string' || !(await bcrypt.compare(bodyData.password, user.password))) {
        return send(res, 401, { message: "email or password is wrong" })
      }
      send(res, 200, { message: "login success", user: hide(user) })
    })
  }

  for (const [name, plural] of resources) {
    const file = `${plural}.json`

    // GET
    if (req.method === 'GET' && req.url === `/${plural}`) {
      let fileData = read_file(file)

      return send(res, 200, fileData.map(hide))
    }

    // GET (bitta)
    if (req.method === 'GET' && url_action === name && url_id !== null) {
      const item = read_file(file).find((el) => el.id === url_id)

      if (!item) return send(res, 404, { message: `${name} not found` })
      return send(res, 200, hide(item))
    }

    // POST
    if (req.method === "POST" && req.url === `/add_${name}`) {
      return get_body(req, async (error, bodyData) => {
        if (error) return send(res, 400, { message: "invalid json" })

        bodyData = await hash_body(bodyData)
        let fileData = read_file(file)

        fileData.push({ ...bodyData, id: next_id(fileData), created_at: new Date().toISOString() })
        write_file(file, fileData)
        send(res, 201, { message: `added new ${name}` })
      })
    }

    // PUT
    if (req.method === "PUT" && url_action === `update_${name}` && url_id !== null) {
      return get_body(req, async (error, bodyData) => {
        if (error) return send(res, 400, { message: "invalid json" })

        bodyData = await hash_body(bodyData)
        let fileData = read_file(file)
        const index = fileData.findIndex((el) => el.id === url_id)

        if (index === -1) return send(res, 404, { message: `${name} not found` })

        fileData[index] = { ...fileData[index], ...bodyData, id: fileData[index].id }
        write_file(file, fileData)
        send(res, 200, { message: `updated ${name}` })
      })
    }

    // DELETE
    if (req.method === "DELETE" && url_action === `delete_${name}` && url_id !== null) {
      let fileData = read_file(file)
      const index = fileData.findIndex((el) => el.id === url_id)

      if (index === -1) return send(res, 404, { message: `${name} not found` })

      fileData.splice(index, 1)
      write_file(file, fileData)
      return send(res, 200, { message: `deleted ${name}` })
    }
  }

  send(res, 404, { message: "route not found" })
});


app.listen(3000, () => {
  console.log('Server 3000-Portda ishladi');
});

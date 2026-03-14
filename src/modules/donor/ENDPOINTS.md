# Donor API Endpoints

Base path: **`/api/v1/donors`**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/donors` | List donors (supports filters and pagination) |
| `GET` | `/api/v1/donors/:id` | Get donor by ID |
| `POST` | `/api/v1/donors/create` | Create a donor |
| `PUT` | `/api/v1/donors/:id` | Update a donor |
| `DELETE` | `/api/v1/donors/:id` | Delete a donor |

## Query / body details

| Endpoint | Params / query / body |
|----------|------------------------|
| **GET** `/api/v1/donors` | Query: `name`, `email`, `phoneNo` (optional filters), `page`, `limit` (pagination) |
| **GET** `/api/v1/donors/:id` | Params: `id` (number) |
| **POST** `/api/v1/donors/create` | Body: `name`, `email`, `phoneNo` (all required) |
| **PUT** `/api/v1/donors/:id` | Params: `id` (number). Body: at least one of `name`, `email`, `phoneNo` |
| **DELETE** `/api/v1/donors/:id` | Params: `id` (number) |

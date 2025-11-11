# Snazo Backend API Documentation

## Overview
This is a comprehensive backend API for the Snazo frozen foods e-commerce platform. It provides full CRUD functionality for products, offers, users, orders, and includes admin management capabilities.

## Authentication
All admin endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Base URL
```
http://localhost:3000/api
```

## Authentication Endpoints

### Register User
- **POST** `/auth/register`
- **Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "phone": "+1234567890",
  "address": "123 Main St"
}
```

### Login
- **POST** `/auth/login`
- **Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Get Current User
- **GET** `/auth/me`
- **Headers:** `Authorization: Bearer <token>`

## Product Management

### Get All Products
- **GET** `/products`
- **Query Parameters:**
  - `page` (number): Page number (default: 1)
  - `limit` (number): Items per page (default: 10)
  - `category` (string): Filter by category slug
  - `featured` (boolean): Filter featured products
  - `search` (string): Search in name and description
  - `isActive` (boolean): Filter by active status

### Get Single Product
- **GET** `/products/{id}`

### Create Product (Admin)
- **POST** `/products`
- **Headers:** `Authorization: Bearer <admin-token>`
- **Body:**
```json
{
  "name": "Premium Frozen Pizza",
  "slug": "premium-frozen-pizza",
  "description": "Delicious frozen pizza with premium toppings",
  "price": 12.99,
  "originalPrice": 15.99,
  "image": "/uploads/pizza.jpg",
  "sku": "FPZ-001",
  "stock": 100,
  "isActive": true,
  "isFeatured": false,
  "categoryId": "category-id"
}
```

### Update Product (Admin)
- **PUT** `/products/{id}`
- **Headers:** `Authorization: Bearer <admin-token>`
- **Body:** Same as create, but all fields are optional

### Delete Product (Admin)
- **DELETE** `/products/{id}`
- **Headers:** `Authorization: Bearer <admin-token>`

## Category Management

### Get All Categories
- **GET** `/categories`

### Create Category (Admin)
- **POST** `/categories`
- **Headers:** `Authorization: Bearer <admin-token>`
- **Body:**
```json
{
  "name": "Frozen Meals",
  "slug": "frozen-meals",
  "description": "Complete frozen meals",
  "image": "/uploads/category.jpg"
}
```

### Update Category (Admin)
- **PUT** `/categories/{id}`
- **Headers:** `Authorization: Bearer <admin-token>`

### Delete Category (Admin)
- **DELETE** `/categories/{id}`
- **Headers:** `Authorization: Bearer <admin-token>`

## Offer/Discount Management

### Get All Offers
- **GET** `/offers`
- **Query Parameters:**
  - `page` (number): Page number
  - `limit` (number): Items per page
  - `isActive` (boolean): Filter by active status
  - `code` (string): Search by code

### Get Single Offer
- **GET** `/offers/{id}`

### Create Offer (Admin)
- **POST** `/offers`
- **Headers:** `Authorization: Bearer <admin-token>`
- **Body:**
```json
{
  "title": "Summer Sale",
  "code": "SUMMER20",
  "description": "20% off on all products",
  "type": "PERCENTAGE",
  "value": 20,
  "minAmount": 50,
  "maxUses": 100,
  "isActive": true,
  "startsAt": "2024-06-01T00:00:00Z",
  "endsAt": "2024-08-31T23:59:59Z",
  "productIds": ["product-id-1", "product-id-2"]
}
```

### Update Offer (Admin)
- **PUT** `/offers/{id}`
- **Headers:** `Authorization: Bearer <admin-token>`

### Delete Offer (Admin)
- **DELETE** `/offers/{id}`
- **Headers:** `Authorization: Bearer <admin-token>`

## Order Management

### Get User Orders
- **GET** `/orders`
- **Headers:** `Authorization: Bearer <token>`

### Create Order
- **POST** `/orders`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "items": [
    {
      "productId": "product-id",
      "quantity": 2
    }
  ],
  "shippingAddress": "123 Main St, City, State",
  "paymentMethod": "CREDIT_CARD",
  "offerCode": "SUMMER20"
}
```

### Get Order Details
- **GET** `/orders/{id}`
- **Headers:** `Authorization: Bearer <token>`

## Admin Management Endpoints

### Dashboard Statistics
- **GET** `/admin/dashboard`
- **Headers:** `Authorization: Bearer <admin-token>`
- **Returns:** Dashboard stats, recent orders, top products, monthly data

### User Management
- **GET** `/admin/users`
- **POST** `/admin/users`
- **PUT** `/admin/users/{id}`
- **DELETE** `/admin/users/{id}`
- **Headers:** `Authorization: Bearer <admin-token>`

### Order Management (Admin)
- **GET** `/admin/orders`
- **PUT** `/admin/orders/{id}`
- **Headers:** `Authorization: Bearer <admin-token>`

### Analytics
- **GET** `/admin/analytics`
- **Query Parameters:**
  - `period` (number): Number of days (default: 30)
- **Headers:** `Authorization: Bearer <admin-token>`
- **Returns:** Sales analytics, order breakdown, top products, customer analytics

### Inventory Management
- **GET** `/admin/inventory`
- **POST** `/admin/inventory`
- **Query Parameters:**
  - `lowStock` (boolean): Filter low stock items
  - `outOfStock` (boolean): Filter out of stock items
  - `category` (string): Filter by category
- **Headers:** `Authorization: Bearer <admin-token>`

### Bulk Operations
- **POST** `/admin/products/bulk`
- **Headers:** `Authorization: Bearer <admin-token>`
- **Body:**
```json
{
  "operation": "activate|deactivate|delete|updatePrice|updateStock",
  "productIds": ["id1", "id2", "id3"],
  "data": {
    "price": 19.99,
    "stock": 50
  }
}
```

### File Upload
- **POST** `/admin/upload`
- **Headers:** `Authorization: Bearer <admin-token>`
- **Content-Type:** `multipart/form-data`
- **Form Data:** `file` (image file)

## Reviews

### Get Product Reviews
- **GET** `/reviews`
- **Query Parameters:**
  - `productId` (string): Filter by product ID
  - `rating` (number): Filter by rating

### Create Review
- **POST** `/reviews`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "productId": "product-id",
  "rating": 5,
  "comment": "Excellent product!"
}
```

## Error Responses
All endpoints return consistent error responses:
```json
{
  "error": "Error message",
  "details": "Additional error details (if applicable)"
}
```

## Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Data Models

### User
```json
{
  "id": "string",
  "email": "string",
  "name": "string",
  "phone": "string",
  "address": "string",
  "role": "USER|ADMIN",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Product
```json
{
  "id": "string",
  "name": "string",
  "slug": "string",
  "description": "string",
  "price": "number",
  "originalPrice": "number",
  "image": "string",
  "sku": "string",
  "stock": "number",
  "isActive": "boolean",
  "isFeatured": "boolean",
  "rating": "number",
  "reviewCount": "number",
  "categoryId": "string",
  "category": "Category",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Order
```json
{
  "id": "string",
  "orderNumber": "string",
  "userId": "string",
  "status": "PENDING|PROCESSING|SHIPPED|DELIVERED|CANCELLED",
  "subtotal": "number",
  "discount": "number",
  "tax": "number",
  "shipping": "number",
  "total": "number",
  "notes": "string",
  "shippingAddress": "string",
  "paymentMethod": "string",
  "paymentStatus": "PENDING|PAID|FAILED|REFUNDED",
  "items": ["OrderItem"],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Offer
```json
{
  "id": "string",
  "title": "string",
  "code": "string",
  "description": "string",
  "type": "PERCENTAGE|FIXED_AMOUNT|FREE_SHIPPING",
  "value": "number",
  "minAmount": "number",
  "maxUses": "number",
  "usedCount": "number",
  "isActive": "boolean",
  "startsAt": "datetime",
  "endsAt": "datetime",
  "productOffers": ["ProductOffer"],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

## Notes
- All datetime fields are in ISO 8601 format
- Pagination follows the format: `{ data: [], pagination: { page, limit, total, pages } }`
- File uploads are limited to 5MB and accept JPEG, PNG, and WebP formats
- Products with existing orders cannot be deleted, only deactivated
- Stock is automatically managed when orders are created or cancelled
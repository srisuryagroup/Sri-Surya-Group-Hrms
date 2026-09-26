# Sri  Surya Group Hrms 

# Sri Surya Group HRMS – Day 1 (MVP)

Build a premium enterprise-grade Employee & Freelancer Management System for **Sri Surya Group** with a modern SaaS UI similar to Notion, Zoho People, BambooHR, and Linear. The application must be fully responsive, production-ready, fast, secure, and built with reusable components.

## Brand

Company Name: Sri Surya Group

Application Name: Sri Surya Group HRMS

Tagline: Manage Employees, Freelancers, Projects & Business Operations in One Platform

Footer:

© 2026 Sri Surya Group. All Rights Reserved.

---

## Technology Stack

- React

- TypeScript

- Vite

- Tailwind CSS

- Supabase

- Supabase Authentication

- Supabase Database

- Supabase Storage

- React Router

- React Hook Form

- Zod Validation

- TanStack Table

- Recharts

- Responsive Design

- Dark/Light Mode

---

## Authentication

Create secure authentication using Supabase.

Roles

- Super Admin

- HR Manager

- Manager

- Employee

- Freelancer

Features

- Email Login

- Forgot Password

- Reset Password

- Remember Login

- Protected Routes

- Session Management

- Role Based Access Control

- Logout

---

## Dashboard

Create a beautiful modern dashboard.

Dashboard Cards

- Total Employees

- Total Freelancers

- Total Departments

- Active Projects

- Pending Tasks

- Today's Attendance

- Pending Leave Requests

- Pending Commission

- Recent Activities

Charts

- Employee Growth

- Attendance

- Department Distribution

- Projects Overview

Quick Actions

- Add Employee

- Add Freelancer

- Create Project

- Create Task

---

## Employee Management

Complete CRUD.

Fields

- Employee ID (Auto Generate)

- Employee Photo

- Full Name

- Email

- Mobile Number

- Gender

- Date of Birth

- Department

- Designation

- Joining Date

- Employment Type

- Salary

- Aadhaar Number

- PAN Number

- Bank Name

- Account Number

- IFSC Code

- UPI ID

- Address

- Emergency Contact

- Status

Functions

- Add

- Edit

- Delete

- Search

- Filter

- View Profile

- Export CSV

---

## Freelancer Management

Complete CRUD.

Fields

- Freelancer ID

- Photo

- Full Name

- Email

- Mobile

- Skills

- Experience

- Hourly Rate

- UPI ID

- Bank Details

- Resume Upload

- Portfolio URL

- Availability

- Status

Functions

- Add

- Edit

- Delete

- Search

- Filter

---

## Department Management

Create CRUD.

Fields

- Department Name

- Department Code

- Department Head

- Description

---

## Project Management

Fields

- Project Name

- Client Name

- Description

- Budget

- Start Date

- End Date

- Priority

- Status

Functions

- Assign Employees

- Assign Freelancers

- Upload Project Files

- Progress Bar

---

## Task Management

Fields

- Task Name

- Description

- Assigned To

- Due Date

- Priority

- Status

- Attachments

Status

- Pending

- In Progress

- Completed

- On Hold

---

## Commission Management

Support

- Employee Commission

- Freelancer Commission

- Referral Commission

Fields

- Commission Type

- Fixed Amount

- Percentage

- Payment Status

- Payment Date

- Remarks

---

## Documents

Upload

- Aadhaar

- PAN

- Resume

- Offer Letter

- Certificates

- Profile Photo

Store everything inside Supabase Storage.

---

## Search

Global Search

Search Employees

Search Freelancers

Search Projects

Search Tasks

---

## Notifications

Create notification center.

- Task Assigned

- Employee Added

- Freelancer Added

- Project Created

- Commission Paid

---

## Settings

Company Profile

Logo Upload

Business Information

Office Address

Email

Phone

Timezone

Currency

Working Hours

---

## User Interface

Premium SaaS Design

- Glassmorphism Cards

- Left Sidebar

- Top Navigation

- Search Bar

- Notification Bell

- User Profile Menu

- Modern Tables

- Responsive Mobile Menu

- Pagination

- Filters

- Modal Forms

- Skeleton Loading

- Empty States

- Toast Notifications

- Smooth Animations

- Professional Icons

- Dark Mode

---

## Database

Create Supabase tables.

users

employees

freelancers

departments

projects

tasks

commissions

documents

notifications

settings

Enable Row Level Security (RLS).

Create proper relationships.

Add created_at and updated_at timestamps.

---

## Sample Data

Automatically create

- 1 Super Admin

- 2 HR Managers

- 3 Managers

- 10 Employees

- 5 Freelancers

- 5 Departments

- 5 Projects

- 20 Tasks

- Sample Commission Records

---

## Final Requirements

Build a fully working Day 1 MVP with real CRUD functionality, Supabase integration, responsive design, clean reusable code, proper validation, loading states, error handling, and a professional UI. Do not use placeholder pages. Every module should be functional and ready for deployment on Vercel. Structure the code for easy expansion on Day 2 with attendance, leave management, payroll, reports, video calls, and advanced HR features.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b40f1d1b-1ae6-4b23-aa79-cdafd4cd34a8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

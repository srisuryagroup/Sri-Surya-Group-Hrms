export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          hours_worked: number | null
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number | null
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at: string
          fixed_amount: number | null
          id: string
          payment_date: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          percentage: number | null
          project_id: string | null
          project_value: number | null
          recipient_id: string | null
          recipient_name: string
          remarks: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          fixed_amount?: number | null
          id?: string
          payment_date?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          percentage?: number | null
          project_id?: string | null
          project_value?: number | null
          recipient_id?: string | null
          recipient_name: string
          remarks?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          commission_type?: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          fixed_amount?: number | null
          id?: string
          payment_date?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          percentage?: number | null
          project_id?: string | null
          project_value?: number | null
          recipient_id?: string | null
          recipient_name?: string
          remarks?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          business_info: string | null
          company_name: string
          created_at: string
          currency: string | null
          email: string | null
          id: string
          logo_url: string | null
          office_address: string | null
          phone: string | null
          timezone: string | null
          updated_at: string
          working_hours: string | null
        }
        Insert: {
          business_info?: string | null
          company_name?: string
          created_at?: string
          currency?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          office_address?: string | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Update: {
          business_info?: string | null
          company_name?: string
          created_at?: string
          currency?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          office_address?: string | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          head_name: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          head_name?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          head_name?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          owner_id: string | null
          owner_type: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          owner_id?: string | null
          owner_type?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          owner_id?: string | null
          owner_type?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          aadhaar_number: string | null
          account_number: string | null
          address: string | null
          bank_name: string | null
          created_at: string
          date_of_birth: string | null
          department_id: string | null
          designation: string | null
          email: string
          emergency_contact: string | null
          employee_code: string
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          ifsc_code: string | null
          joining_date: string | null
          mobile: string | null
          pan_number: string | null
          photo_url: string | null
          salary: number | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          designation?: string | null
          email: string
          emergency_contact?: string | null
          employee_code?: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          ifsc_code?: string | null
          joining_date?: string | null
          mobile?: string | null
          pan_number?: string | null
          photo_url?: string | null
          salary?: number | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string
          emergency_contact?: string | null
          employee_code?: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          ifsc_code?: string | null
          joining_date?: string | null
          mobile?: string | null
          pan_number?: string | null
          photo_url?: string | null
          salary?: number | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancers: {
        Row: {
          account_number: string | null
          availability:
            | Database["public"]["Enums"]["availability_status"]
            | null
          bank_name: string | null
          commission_percentage: number
          created_at: string
          email: string
          experience_years: number | null
          freelancer_code: string
          full_name: string
          hourly_rate: number | null
          id: string
          ifsc_code: string | null
          mobile: string | null
          photo_url: string | null
          portfolio_url: string | null
          resume_url: string | null
          skills: string[] | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          account_number?: string | null
          availability?:
            | Database["public"]["Enums"]["availability_status"]
            | null
          bank_name?: string | null
          commission_percentage?: number
          created_at?: string
          email: string
          experience_years?: number | null
          freelancer_code?: string
          full_name: string
          hourly_rate?: number | null
          id?: string
          ifsc_code?: string | null
          mobile?: string | null
          photo_url?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          account_number?: string | null
          availability?:
            | Database["public"]["Enums"]["availability_status"]
            | null
          bank_name?: string | null
          commission_percentage?: number
          created_at?: string
          email?: string
          experience_years?: number | null
          freelancer_code?: string
          full_name?: string
          hourly_rate?: number | null
          id?: string
          ifsc_code?: string | null
          mobile?: string | null
          photo_url?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days: number
          employee_id: string
          end_date: string
          id?: string
          leave_type: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payroll: {
        Row: {
          allowances: number
          basic_salary: number
          bonus: number
          created_at: string
          employee_id: string
          esi: number
          id: string
          month: number
          net_salary: number
          notes: string | null
          other_deductions: number
          paid_on: string | null
          payment_status: string
          payslip_url: string | null
          pf: number
          tax: number
          updated_at: string
          year: number
        }
        Insert: {
          allowances?: number
          basic_salary?: number
          bonus?: number
          created_at?: string
          employee_id: string
          esi?: number
          id?: string
          month: number
          net_salary?: number
          notes?: string | null
          other_deductions?: number
          paid_on?: string | null
          payment_status?: string
          payslip_url?: string | null
          pf?: number
          tax?: number
          updated_at?: string
          year: number
        }
        Update: {
          allowances?: number
          basic_salary?: number
          bonus?: number
          created_at?: string
          employee_id?: string
          esi?: number
          id?: string
          month?: number
          net_salary?: number
          notes?: string | null
          other_deductions?: number
          paid_on?: string | null
          payment_status?: string
          payslip_url?: string | null
          pf?: number
          tax?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          assignee_id: string
          assignee_type: string
          created_at: string
          id: string
          project_id: string
          role: string | null
        }
        Insert: {
          assignee_id: string
          assignee_type: string
          created_at?: string
          id?: string
          project_id: string
          role?: string | null
        }
        Update: {
          assignee_id?: string
          assignee_type?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          client_name: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          priority: Database["public"]["Enums"]["priority_level"] | null
          progress: number
          project_code: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          budget?: number | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["priority_level"] | null
          progress?: number
          project_code?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          budget?: number | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["priority_level"] | null
          progress?: number
          project_code?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_name: string | null
          body: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          assignee_type: string | null
          attachment_url: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          name: string
          priority: Database["public"]["Enums"]["priority_level"] | null
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_name?: string | null
          assignee_type?: string | null
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["priority_level"] | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          assignee_name?: string | null
          assignee_type?: string | null
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["priority_level"] | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_updates: {
        Row: {
          created_at: string
          created_by: string | null
          details: string | null
          employee_id: string | null
          freelancer_id: string | null
          hours_spent: number | null
          id: string
          project_id: string | null
          status: string
          task_id: string | null
          title: string
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          details?: string | null
          employee_id?: string | null
          freelancer_id?: string | null
          hours_spent?: number | null
          id?: string
          project_id?: string | null
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
          work_date?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          details?: string | null
          employee_id?: string | null
          freelancer_id?: string | null
          hours_spent?: number | null
          id?: string
          project_id?: string | null
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_updates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_updates_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage: { Args: { _user_id: string }; Returns: boolean }
      current_user_email: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_employee_id: { Args: never; Returns: string }
      my_freelancer_id: { Args: never; Returns: string }
      user_id_for_email: { Args: { _email: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "hr_manager"
        | "manager"
        | "employee"
        | "freelancer"
      availability_status: "available" | "busy" | "unavailable"
      commission_type: "employee" | "freelancer" | "referral"
      employment_type: "full_time" | "part_time" | "contract" | "intern"
      gender_type: "male" | "female" | "other"
      payment_status: "pending" | "paid" | "cancelled"
      priority_level: "low" | "medium" | "high" | "urgent"
      project_status:
        | "planning"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "cancelled"
      record_status: "active" | "inactive" | "on_leave" | "terminated"
      task_status: "pending" | "in_progress" | "completed" | "on_hold"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "hr_manager",
        "manager",
        "employee",
        "freelancer",
      ],
      availability_status: ["available", "busy", "unavailable"],
      commission_type: ["employee", "freelancer", "referral"],
      employment_type: ["full_time", "part_time", "contract", "intern"],
      gender_type: ["male", "female", "other"],
      payment_status: ["pending", "paid", "cancelled"],
      priority_level: ["low", "medium", "high", "urgent"],
      project_status: [
        "planning",
        "in_progress",
        "on_hold",
        "completed",
        "cancelled",
      ],
      record_status: ["active", "inactive", "on_leave", "terminated"],
      task_status: ["pending", "in_progress", "completed", "on_hold"],
    },
  },
} as const

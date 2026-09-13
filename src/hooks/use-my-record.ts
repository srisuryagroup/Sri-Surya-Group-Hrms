import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type MyEmployee = {
  id: string;
  full_name: string;
  email: string;
  employee_code: string;
  designation: string | null;
  mobile: string | null;
  address: string | null;
  emergency_contact: string | null;
  joining_date: string | null;
  salary: number | null;
  photo_url: string | null;
  department_id: string | null;
};

export type MyFreelancer = {
  id: string;
  full_name: string;
  email: string;
  freelancer_code: string;
  mobile: string | null;
  skills: string[] | null;
  hourly_rate: number | null;
  commission_percentage: number;
  portfolio_url: string | null;
  experience_years: number | null;
  photo_url: string | null;
};

/** The employee record linked to the signed-in user's email. */
export function useMyEmployee() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery({
    queryKey: ["my-employee", email],
    enabled: !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id,full_name,email,employee_code,designation,mobile,address,emergency_contact,joining_date,salary,photo_url,department_id",
        )
        .eq("email", email!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as MyEmployee | null;
    },
  });
}

/** The freelancer record linked to the signed-in user's email. */
export function useMyFreelancer() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery({
    queryKey: ["my-freelancer", email],
    enabled: !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freelancers")
        .select(
          "id,full_name,email,freelancer_code,mobile,skills,hourly_rate,commission_percentage,portfolio_url,experience_years,photo_url",
        )
        .eq("email", email!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as MyFreelancer | null;
    },
  });
}

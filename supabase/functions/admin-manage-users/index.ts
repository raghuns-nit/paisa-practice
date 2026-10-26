import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  action: "create_user" | "reset_password" | "delete_user";
  // create_user
  email?: string;
  password?: string;
  display_name?: string;
  family_id?: string;
  setup_code?: string;
  kyc?: {
    pan: string;
    aadhaar: string;
    dob: string;
    address: string;
    phone: string;
  };
  // reset_password
  user_id?: string;
  // delete_user
  profile_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    // Verify caller is authenticated and is the super admin
    const callerClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: callerData, error: authError } = await callerClient.auth.getUser();
    if (authError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerUserId = callerData.user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if caller is super admin
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("is_super_admin, family_id")
      .eq("auth_user_id", callerUserId)
      .maybeSingle();

    if (profileError || !callerProfile || !callerProfile.is_super_admin) {
      return new Response(JSON.stringify({ error: "Forbidden: super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const familyId = callerProfile.family_id;

    if (body.action === "create_user") {
      const { email, password, display_name, kyc } = body;
      if (!email || !password || !display_name) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check PAN uniqueness if KYC provided
      if (kyc?.pan) {
        const { data: existing } = await adminClient
          .from("profiles")
          .select("id")
          .filter("meta->kyc->>pan", "eq", kyc.pan)
          .maybeSingle();
        if (existing) {
          return new Response(JSON.stringify({ error: "PAN already exists" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: authData, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newUserId = authData.user.id;
      const profileId = `prof_${display_name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now().toString(36)}`;

      const { error: profileErr } = await adminClient.from("profiles").insert({
        id: profileId,
        family_id: familyId,
        auth_user_id: newUserId,
        display_name,
        role: "learner",
        sim_date: new Date().toISOString().slice(0, 10),
        phone_sim: kyc?.phone || null,
        meta: kyc ? { kyc } : {},
        is_super_admin: false,
      });

      if (profileErr) {
        // Clean up auth user if profile creation fails
        await adminClient.auth.admin.deleteUser(newUserId);
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, profile_id: profileId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "reset_password") {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: "Missing user_id or password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateErr } = await adminClient.auth.admin.updateUserById(user_id, {
        password,
      });

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "delete_user") {
      const { profile_id } = body;
      if (!profile_id) {
        return new Response(JSON.stringify({ error: "Missing profile_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get auth_user_id before deleting profile
      const { data: prof } = await adminClient
        .from("profiles")
        .select("auth_user_id, is_super_admin")
        .eq("id", profile_id)
        .maybeSingle();

      if (!prof) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (prof.is_super_admin) {
        return new Response(JSON.stringify({ error: "Cannot delete super admin" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("profiles").delete().eq("id", profile_id);
      if (prof.auth_user_id) {
        await adminClient.auth.admin.deleteUser(prof.auth_user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

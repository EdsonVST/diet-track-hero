import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Leaf } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo 6 caracteres").max(100);
const nomeSchema = z.string().trim().min(2, "Informe seu nome").max(100);

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // signin
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  // signup
  const [suNome, setSuNome] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = emailSchema.safeParse(siEmail);
    const pw = passwordSchema.safeParse(siPassword);
    if (!em.success) return toast.error(em.error.issues[0].message);
    if (!pw.success) return toast.error(pw.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: em.data,
      password: pw.data,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const nm = nomeSchema.safeParse(suNome);
    const em = emailSchema.safeParse(suEmail);
    const pw = passwordSchema.safeParse(suPassword);
    if (!nm.success) return toast.error(nm.error.issues[0].message);
    if (!em.success) return toast.error(em.error.issues[0].message);
    if (!pw.success) return toast.error(pw.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: em.data,
      password: pw.data,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { nome: nm.data },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Você já pode entrar.");
    setTab("signin");
    setSiEmail(em.data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/40 to-accent/40 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary grid place-items-center shadow-lg shadow-primary/20 mb-3">
            <Leaf className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">NutriControl</h1>
          <p className="text-sm text-muted-foreground">Seu controle alimentar pessoal</p>
        </div>
        <Card className="border-border/60 shadow-xl shadow-primary/5">
          <CardHeader>
            <CardTitle>Acesse sua conta</CardTitle>
            <CardDescription>Acompanhe sua alimentação diária</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input
                      id="si-email"
                      type="email"
                      autoComplete="email"
                      value={siEmail}
                      onChange={(e) => setSiEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-password">Senha</Label>
                    <Input
                      id="si-password"
                      type="password"
                      autoComplete="current-password"
                      value={siPassword}
                      onChange={(e) => setSiPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-nome">Nome</Label>
                    <Input
                      id="su-nome"
                      value={suNome}
                      onChange={(e) => setSuNome(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input
                      id="su-email"
                      type="email"
                      autoComplete="email"
                      value={suEmail}
                      onChange={(e) => setSuEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Senha</Label>
                    <Input
                      id="su-password"
                      type="password"
                      autoComplete="new-password"
                      value={suPassword}
                      onChange={(e) => setSuPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Criando..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

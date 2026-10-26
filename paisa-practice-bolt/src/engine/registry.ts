export interface TimelineEvent {
  date: string;
  priority: number;
  event_key: string;
  event: string;
  detail: string;
  apply: (ctx: TimelineContext) => Promise<void>;
}

export interface TimelineContext {
  profileId: string;
  simDate: string;
  supabase: typeof import('../lib/supabase').supabase;
}

export type Generator = (ctx: GeneratorContext) => Promise<TimelineEvent[]>;

export interface GeneratorContext {
  profileId: string;
  fromDate: string;
  toDate: string;
  supabase: typeof import('../lib/supabase').supabase;
}

const generators: Generator[] = [];

export function registerGenerator(gen: Generator): void {
  if (!generators.includes(gen)) {
    generators.push(gen);
  }
}

export function getGenerators(): Generator[] {
  return generators;
}

export async function collectEvents(ctx: GeneratorContext): Promise<TimelineEvent[]> {
  const all: TimelineEvent[] = [];
  for (const gen of generators) {
    const events = await gen(ctx);
    all.push(...events);
  }
  all.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.event_key.localeCompare(b.event_key);
  });
  return all;
}

export async function applyEvents(events: TimelineEvent[], ctx: TimelineContext): Promise<void> {
  for (const event of events) {
    const { data: existing } = await ctx.supabase
      .from('sim_events')
      .select('id')
      .eq('profile_id', ctx.profileId)
      .eq('event_key', event.event_key)
      .maybeSingle();

    if (existing) continue;

    await event.apply(ctx);

    await ctx.supabase.from('sim_events').insert({
      profile_id: ctx.profileId,
      event_key: event.event_key,
      event: event.event,
      detail: event.detail,
    });
  }
}

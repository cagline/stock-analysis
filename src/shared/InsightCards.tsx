import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import type { InsightCard } from './historyInsights';

type Props = {
  cards: InsightCard[];
};

export function InsightCards({ cards }: Props) {
  if (cards.length === 0) return null;

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {cards.map((card) => (
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={card.label}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" display="block">
                {card.label}
              </Typography>
              <Typography variant="h6" component="div" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {card.value}
              </Typography>
              {card.hint && (
                <Typography variant="caption" color="text.secondary">
                  {card.hint}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          {title}
        </Typography>
        <Box sx={{ width: '100%', height: 280 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

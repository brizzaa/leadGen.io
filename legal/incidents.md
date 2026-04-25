# Incident log — accountability ex art. 5.2 GDPR

Registro degli incidenti privacy/sicurezza riscontrati nel sistema leader-gen
e delle relative azioni correttive. Conservato a fini di accountability ex
art. 5, paragrafo 2 del Reg. UE 2016/679.

---

## INC-2026-04-25-01 — Invio non autorizzato a indirizzi PEC

**Data rilevazione**: 25 aprile 2026
**Data correzione**: 25 aprile 2026 (stesso giorno)
**Severità**: Media (violazione di base giuridica documentata)
**Stato**: Chiuso, mitigato

### Descrizione del fatto

In una campagna di outreach B2B (campaign id 11) sono stati inviati 14 messaggi
commerciali a indirizzi email classificabili come PEC (Posta Elettronica
Certificata), individuati a posteriori sulla base dei domini `@*.pec.*`,
`@*legalmail*`, `@*legal-mail*`, `@*pecimprese*`. Cumulativamente, includendo
campagne precedenti, sono stati inviati 27 messaggi a indirizzi PEC.

L'uso a fini di marketing diretto di PEC pubblicate sul registro INI-PEC e
analoghi è esplicitamente vietato dal Garante per la Protezione dei Dati
Personali (provvedimento doc-web 9899880 del 17 maggio 2023).

### Causa principale

Lo script di selezione candidati (`backend/scripts/runCampaignMass.js`,
funzione `pickBusinesses`) non includeva un filtro sui pattern di dominio PEC
al momento della query SQL. La policy di esclusione era documentata nel LIA
(`legal/LIA.md` §6) ma non implementata tecnicamente.

### Azioni correttive immediate (entro la stessa giornata)

1. **Patch dello script**: aggiunto filtro `b.email NOT LIKE '%@pec.%' AND
   b.email NOT LIKE '%legalmail%' AND ...` in `pickBusinesses` per impedire
   nuovi invii.
2. **Blacklist permanente**: tutti i 41 indirizzi PEC presenti nel DB sono
   stati marcati `is_blacklisted = 1` per impedire ogni futuro contatto.
3. **Log accountability**: per ogni record blacklistato è stato registrato un
   `activity_log` di tipo `pec_excluded` con riferimento al provvedimento
   Garante.
4. **Aggiornamento LIA**: il presente incidente è citato nel registro degli
   incidenti come evidenza di immediate corrective action.

### Azioni di follow-up

- In caso di reclamo da uno dei 14 destinatari della campagna del 25/04/2026:
  - Riferire all'autorità le azioni correttive assunte lo stesso giorno
    della rilevazione;
  - Procedere a cancellazione completa del record (non solo blacklist) su
    richiesta;
  - Pubblicazione di scuse formali se richiesto.
- Verifica trimestrale dei pattern di esclusione contro nuovi domini PEC
  emersi (es. nuovi provider qualificati AGID).

### Lezioni apprese

- Le esclusioni documentate nel LIA devono essere implementate **tecnicamente**
  nei punti di esecuzione (selezione candidati, invio email), non solo
  policy-level. Auditare ogni script di outreach contro la lista esclusioni
  prima del go-live.
- Aggiungere unit test che verifichi che `pickBusinesses` non ritorni mai
  email matching pattern PEC noti.

---

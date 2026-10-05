# Plantillas de WhatsApp

WhatsApp solo deja que una empresa inicie una conversación con mensajes de plantilla aprobados
por Meta. Estas son las plantillas que usa ORGATODO. Hay que crearlas en el
[Administrador de WhatsApp](https://business.facebook.com/wa/manage/message-templates/) con el
**mismo nombre**, categoría **Utilidad**, idioma **Español (ARG)** (`es_AR`) y las variables en el
mismo orden. El texto se puede ajustar, pero cada `{{n}}` tiene que seguir significando lo mismo
(`src/lib/notifications/messages.ts` arma los valores).

## orgatodo_reserva_recibida

> Hola {{1}}, recibimos tu reserva de {{2}} con {{3}} para el {{4}} a las {{5}}. Te avisamos cuando la confirme. Para ver o cancelar el turno: {{6}}

## orgatodo_turno_confirmado

> Hola {{1}}, tu turno de {{2}} con {{3}} quedó confirmado para el {{4}} a las {{5}}. Para ver o cancelar el turno: {{6}}

## orgatodo_nuevo_turno

> Tenés un turno nuevo de {{1}} para {{2}} el {{3}} a las {{4}}. Miralo en tu panel: {{5}}

## orgatodo_recordatorio

> Hola {{1}}, te recordamos tu turno de {{2}} con {{3}} el {{4}} a las {{5}}. Si no podés ir, cancelalo acá: {{6}}

## orgatodo_cancelado_por_cliente

> {{1}} canceló su turno de {{2}} del {{3}} a las {{4}}. El horario quedó libre.

## orgatodo_cancelado_por_profesional

> Hola {{1}}, {{2}} canceló tu turno de {{3}} del {{4}} a las {{5}}. Podés reservar otro horario desde su página.

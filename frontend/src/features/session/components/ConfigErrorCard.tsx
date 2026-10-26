import Card from '../../../shared/components/ui/Card'

/** La configuración de autenticación es inválida: se informa en lugar de arrancar. */
const ConfigErrorCard = ({ message }: { message: string }) => (
  <Card error role="alert" className="space-y-2">
    <h1 className="text-xl font-bold">Configuración incompleta</h1>
    <p>{message}</p>
    <p className="text-sm text-muted">Revisá el archivo .env del frontend (ver .env.example) y reiniciá Vite.</p>
  </Card>
)

export default ConfigErrorCard

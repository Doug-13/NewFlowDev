import { useState } from 'react'
import { Alert, Button, Card, Select, Space, Table, Tag, Typography, Upload, message } from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'

type Row = { row: number; title: string; metadata: Record<string,string>; errors: string[] }
type Preview = { fileHash: string; total: number; valid: number; invalid: number; rows: Row[] }
type Result = { total: number; created: number; errors: number; partial: boolean;
  results: { row: number; id?: string; code?: string; error?: string }[] }

export function LDImportPanel({ processId }: { processId: string }) {
  const [fileList,setFileList] = useState<UploadFile[]>([])
  const [workflowId,setWorkflowId] = useState<string>()
  const [preview,setPreview] = useState<Preview>()
  const [result,setResult] = useState<Result>()
  const [busy,setBusy] = useState(false)
  const { data: workflows=[] } = useQuery<{id:string;name:string}[]>({
    queryKey:['ld-import-workflows',processId],
    queryFn: async()=> (await api.get('/workflows',{params:{processId}})).data,
    enabled:!!processId,
  })
  const file = fileList[0]?.originFileObj
  async function send(action:'preview'|'commit') {
    if (!file || !workflowId) { message.warning('Selecione um workflow e uma planilha XLSX.');return }
    const body = new FormData()
    body.append('file',file)
    body.append('workflowId',workflowId)
    if(action==='commit') body.append('expectedHash',preview?.fileHash ?? '')
    setBusy(true)
    try {
      const response = await api.post(`/ld-import/${encodeURIComponent(processId)}/${action}`, body)
      if(action==='preview') { setPreview(response.data as Preview);setResult(undefined);message.success('Planilha analisada. Nenhum documento foi criado.') }
      else { const value=response.data as Result;setResult(value);setPreview(undefined);message[value.partial?'warning':'success'](`${value.created} documento(s) criado(s).`) }
    } catch(e: unknown) {
      const err=e as {response?:{data?:{message?:string|string[]}};message?:string}
      const detail=err.response?.data?.message
      message.error(Array.isArray(detail)?detail.join(', '):detail??err.message??'Falha na importação.')
    } finally { setBusy(false) }
  }
  return <Card size="small" title="Importar planilha LD" style={{marginTop:16}}>
    <Alert type="info" showIcon message="Importação de documentos" description="Salve o mapeamento da LD antes de validar. A primeira aba do XLSX será utilizada; cada linha válida criará um documento após sua confirmação." style={{marginBottom:16}}/>
    <Space wrap style={{marginBottom:16}}>
      <Select placeholder="Workflow do processo" style={{minWidth:260}} value={workflowId} onChange={v=>{setWorkflowId(v);setPreview(undefined);setResult(undefined)}}
        options={workflows.map(w=>({value:w.id,label:w.name}))}/>
      <Upload maxCount={1} fileList={fileList} beforeUpload={()=>false} accept=".xlsx" onChange={info=>{setFileList(info.fileList);setPreview(undefined);setResult(undefined)}}>
        <Button>Selecionar XLSX</Button>
      </Upload>
      <Button loading={busy} disabled={!file||!workflowId} onClick={()=>void send('preview')}>Validar planilha</Button>
    </Space>
    {preview && <>
      <Typography.Text strong>Prévia: {preview.total} linha(s), {preview.valid} válida(s), {preview.invalid} com erro(s).</Typography.Text>
      <Table size="small" rowKey="row" pagination={{pageSize:10}} scroll={{x:650}} style={{marginTop:12}} dataSource={preview.rows}
        columns={[{title:'Linha',dataIndex:'row',width:80},{title:'Título',dataIndex:'title'},
          {title:'Situação',render:(_,r:Row)=>r.errors.length?<Tag color="red">Erro</Tag>:<Tag color="green">Válida</Tag>},
          {title:'Observações',render:(_,r:Row)=>r.errors.join('; ')||'—'}]}/>
      <Button type="primary" danger loading={busy} disabled={preview.invalid>0 || !preview.valid}
        onClick={()=>void send('commit')}>Confirmar importação de {preview.valid} documento(s)</Button>
      <Typography.Paragraph type="secondary" style={{marginTop:8,fontSize:12}}>A confirmação cria registros reais. Não repita o envio da mesma planilha sem verificar os documentos gerados.</Typography.Paragraph>
    </>}
    {result && <>
      <Alert showIcon type={result.partial?'warning':'success'} message={`${result.created} de ${result.total} documento(s) criado(s)`}
        description={result.partial?'Importação parcial: confira as linhas abaixo antes de tentar novamente.':'Importação concluída.'} style={{marginBottom:12}}/>
      <Table size="small" pagination={{pageSize:10}} dataSource={result.results} rowKey="row" columns={[
        {title:'Linha',dataIndex:'row'},{title:'Código',dataIndex:'code'},{title:'Resultado',render:(_,r)=>r.error??'Criado'},
      ]}/>
    </>}
  </Card>
}

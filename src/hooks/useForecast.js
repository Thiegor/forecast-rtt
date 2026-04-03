import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useForecast(perfil) {
  const [projetos, setProjetos] = useState([])
  const [forecastSemana, setForecastSemana] = useState([])
  const [loading, setLoading] = useState(true)

  const semanaAtual = getISOWeek(new Date())
  const anoAtual = new Date().getFullYear()

  const mes1 = getMesNome(0)
  const mes2 = getMesNome(1)
  const mes3 = getMesNome(2)
  const ano1 = getAno(0)
  const ano2 = getAno(1)
  const ano3 = getAno(2)

  const carregar = useCallback(async () => {
    if (!perfil) return
    setLoading(true)

    // Carregar projetos
    let query = supabase.from('projetos').select('*').eq('status', 'Vigente').order('identificacao')
    if (perfil.perfil === 'gestor') {
      query = query.eq('gerente_site', perfil.nome)
    }
    const { data: proj } = await query
    setProjetos(proj || [])

    // Carregar forecast da semana atual
    const { data: fc } = await supabase
      .from('forecast_semanal')
      .select('*')
      .eq('semana_coleta', semanaAtual)
      .eq('ano_referencia', anoAtual)
    setForecastSemana(fc || [])

    setLoading(false)
  }, [perfil, semanaAtual, anoAtual])

  useEffect(() => { carregar() }, [carregar])

  async function enviarForecast(valores) {
    // valores: { [chave_rfc]: { mes1: val, mes2: val, mes3: val, confianca, observacoes } }
    const registros = []

    for (const [chave_rfc, vals] of Object.entries(valores)) {
      const projeto = projetos.find(p => p.chave_rfc === chave_rfc)
      if (!projeto) continue

      const meses = [
        { mes: mes1, ano: ano1, val: vals.mes1 },
        { mes: mes2, ano: ano2, val: vals.mes2 },
        { mes: mes3, ano: ano3, val: vals.mes3 },
      ]

      for (const { mes, ano, val } of meses) {
        if (!val || parseFloat(val) === 0) continue
        registros.push({
          chave_unica: `${chave_rfc}-${mes}-${ano}-${semanaAtual}`,
          chave_rfc,
          identificacao: projeto.identificacao,
          grupo: projeto.grupo,
          gerente_site: perfil.nome,
          mes_referencia: mes,
          ano_referencia: ano,
          semana_coleta: semanaAtual,
          receita_prevista: parseFloat(val),
          confianca: vals.confianca || null,
          observacoes: vals.observacoes || null,
          data_coleta: new Date().toISOString(),
        })
      }
    }

    if (registros.length === 0) throw new Error('Nenhum valor preenchido')

    const { error } = await supabase
      .from('forecast_semanal')
      .upsert(registros, { onConflict: 'chave_unica' })

    if (error) throw error
    await carregar()
    return registros.length
  }

  function getValorExistente(chave_rfc, mes) {
    return forecastSemana.find(f => f.chave_rfc === chave_rfc && f.mes_referencia === mes)?.receita_prevista || ''
  }

  function getConfiancaExistente(chave_rfc) {
    return forecastSemana.find(f => f.chave_rfc === chave_rfc)?.confianca || ''
  }

  return {
    projetos, forecastSemana, loading,
    mes1, mes2, mes3, ano1, ano2, ano3,
    semanaAtual, anoAtual,
    enviarForecast, getValorExistente, getConfiancaExistente,
    recarregar: carregar,
  }
}

function getISOWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

function getMesNome(offset) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toLocaleString('pt-BR', { month: 'long' })
}

function getAno(offset) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.getFullYear()
}
